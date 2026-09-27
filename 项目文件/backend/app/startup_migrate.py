"""服务启动时的建表与增量迁移（幂等，可重复执行）。

部署链路：backend/Dockerfile 的 CMD 先跑本脚本，再启动 uvicorn。
线上库由 Base.metadata.create_all 首次建表，未初始化 alembic_version，
因此 alembic upgrade head 不会自动执行；所有增量结构变更必须在本文件
以幂等 SQL 补做，并与 alembic/versions 下的迁移保持同等变更。

覆盖的增量变更：
1. project_todo.meeting_id       —— 迁移 043
2. project_proposal.meeting_id   —— 迁移 043
3. form.allow_anonymous -> form.allow_visitor 物理列改名 —— 迁移 046
4. note.body / plain_text / restricted_tags 三列 + 存量回填 + 全文搜索索引
   + 新笔记草稿部分唯一索引 —— 迁移 047
5. task.color                    —— 迁移 048
6. link_relation 表删除          —— 迁移 049

注意：create_all 只创建缺失的表，不会给已存在的表补列或改列名，
所以第 1、2、4 项用 ADD COLUMN IF NOT EXISTS；note_link / note_draft 是
新表，由 create_all 直接创建，但其中两个索引模型未声明，需在此补建。
"""

from __future__ import annotations

import json
import sys

import sqlalchemy as sa
from sqlalchemy import create_engine

from app.core.config import get_settings
from app.core.database import Base

# 显式导入全部模型，确保 Base.metadata 完整（与 Dockerfile 原有逻辑一致）
from app.models import *  # noqa: F401, F403


def _wrap_tiptap(text: str) -> dict:
    """把纯文本包成 paragraph 序列的 Tiptap JSON。

    以空行分段；实现与迁移 047 的 _wrap_tiptap 保持一致。
    """
    nodes = [
        {"type": "text", "text": chunk}
        for chunk in (text or "").split("\n\n")
        if chunk != ""
    ]
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [node]} for node in nodes],
    }


def run() -> None:
    """执行建表与全部幂等增量迁移。"""
    settings = get_settings()
    url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")
    engine = create_engine(url)

    # 首次建表；已存在的表不会被改动
    Base.metadata.create_all(engine)

    with engine.begin() as conn:
        # 迁移 043：会议关联列
        conn.execute(
            sa.text(
                "ALTER TABLE project_todo ADD COLUMN IF NOT EXISTS meeting_id "
                "UUID REFERENCES project_meeting(id) ON DELETE SET NULL"
            )
        )
        conn.execute(
            sa.text(
                "ALTER TABLE project_proposal ADD COLUMN IF NOT EXISTS meeting_id "
                "UUID REFERENCES project_meeting(id) ON DELETE SET NULL"
            )
        )

        # 迁移 046：form 表物理列改名，按当前列状态分支，保证幂等
        form_cols = {c["name"] for c in sa.inspect(engine).get_columns("form")}
        if "allow_anonymous" in form_cols:
            if "allow_visitor" in form_cols:
                # 理论上不会出现（create_all 不给已有表补列）；出现则同步数据后删旧列
                conn.execute(sa.text("UPDATE form SET allow_visitor = allow_anonymous"))
                conn.execute(sa.text("ALTER TABLE form DROP COLUMN allow_anonymous"))
            else:
                conn.execute(
                    sa.text(
                        "ALTER TABLE form RENAME COLUMN allow_anonymous TO allow_visitor"
                    )
                )

        # 迁移 048：任务卡片标记色；存量行由 NOT NULL DEFAULT 统一回填 'blue'
        conn.execute(
            sa.text(
                "ALTER TABLE task ADD COLUMN IF NOT EXISTS color VARCHAR(20) "
                "NOT NULL DEFAULT 'blue'"
            )
        )

        # 迁移 047：note 表知识库重做（三列 + 存量回填 + 两个非模型索引）
        conn.execute(sa.text("ALTER TABLE note ADD COLUMN IF NOT EXISTS body JSONB"))
        conn.execute(
            sa.text("ALTER TABLE note ADD COLUMN IF NOT EXISTS plain_text TEXT")
        )
        conn.execute(
            sa.text("ALTER TABLE note ADD COLUMN IF NOT EXISTS restricted_tags JSONB")
        )

        # 存量回填：content 非空且 body 为 NULL 的行。条件自带幂等性，
        # 重复执行时已回填的行不会再被选中
        for rid, content in conn.execute(
            sa.text("SELECT id, content FROM note WHERE body IS NULL")
        ).all():
            if not content:
                continue
            conn.execute(
                sa.text(
                    "UPDATE note SET body = CAST(:b AS jsonb), "
                    "plain_text = :t WHERE id = :i"
                ),
                {
                    "b": json.dumps(_wrap_tiptap(content), ensure_ascii=False),
                    "t": content,
                    "i": str(rid),
                },
            )

        # 全文搜索 GIN 索引：模型未声明，create_all 不会创建
        conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        conn.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_note_plain_text_trgm ON note "
                "USING gin (plain_text gin_trgm_ops)"
            )
        )

        # 新笔记草稿唯一性：note_id 为 NULL 时普通唯一约束不生效
        # （NULL 互不相等），需部分唯一索引；模型未声明，create_all 不会创建
        conn.execute(
            sa.text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_note_draft_new ON note_draft "
                "(owner_id) WHERE note_id IS NULL"
            )
        )

        # meeting_record.notes 列（会议笔记）
        conn.execute(sa.text("ALTER TABLE meeting_record ADD COLUMN IF NOT EXISTS notes TEXT"))

        # 删除 link_relation 通用关联表（零消费者，项目内部关联已由外键覆盖）
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_link_relation_source_type_source_id"))
        conn.execute(sa.text("DROP TABLE IF EXISTS link_relation"))

    print("[startup_migrate] 建表与增量迁移完成")


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup_migrate] 失败：{exc}", file=sys.stderr)
        sys.exit(1)
