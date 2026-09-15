"""note 表为知识库重做补齐结构 + 存量回填 + 双链/草稿新表

Revision ID: 047
Revises: 046
Create Date: 2026-09-16

变更内容：
1. note 表新增三列：
   - body (JSONB, 可空)          新版 Tiptap 文档树
   - plain_text (Text, 可空)     由 body 提取的纯文本，供全文搜索
   - restricted_tags (JSONB, 可空) restricted 可见性下按标签授权
   旧版 content 列保留不删，避免破坏现有数据与旧调用方
2. 存量回填：content 非空且 body 为 NULL 的行，把纯文本包成
   单段或多段 paragraph 的 Tiptap JSON 写入 body，并同步写入 plain_text。
   条件带 body IS NULL，可重复执行（幂等）
3. 新增 note_link 表：双链边索引，图谱与反向链接的唯一数据源，
   (source_id, target_id) 唯一，两端 CASCADE 随 note 删除
4. 新增 note_draft 表：服务端草稿，(owner_id, note_id) 唯一；
   note_id 为 NULL 表示「尚未关联的新笔记草稿」，另建部分唯一索引
   uq_note_draft_new 保证同一用户只有一份未关联草稿
   （NULL 在普通唯一约束下互不相等，无法用唯一约束覆盖该场景）
5. 启用 pg_trgm 扩展并在 plain_text 上建 GIN 三元组索引，
   支撑 ILIKE 全文搜索

部署说明：
- 线上库未初始化 alembic_version，本迁移不会自动执行；同等变更已以
  幂等 inline SQL 写入 app/startup_migrate.py（该脚本由 Dockerfile CMD
  在每次启动时执行）。两处必须保持同等变更。
- 本迁移仅在 PostgreSQL 执行；JSONB 无法渲染到 SQLite 测试库，
  测试走 Base.metadata.create_all（见 app/conftest.py 的 JSONB->JSON 编译适配）。
"""

from __future__ import annotations

import json
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "047"
down_revision: str | None = "046"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _wrap_tiptap(text: str) -> dict:
    """把纯文本包成 paragraph 序列的 Tiptap JSON。

    以空行分段；空串返回空文档。
    """
    chunks = (text or "").split("\n\n")
    nodes = [{"type": "text", "text": chunk} for chunk in chunks if chunk != ""]
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [node]} for node in nodes],
    }


def upgrade() -> None:
    """note 加三列 + 存量回填 + note_link/note_draft 建表 + 全文搜索索引"""
    op.add_column(
        "note",
        sa.Column("body", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("note", sa.Column("plain_text", sa.Text(), nullable=True))
    op.add_column(
        "note",
        sa.Column(
            "restricted_tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )

    # 存量回填：仅处理 body 尚为 NULL 的行，故可重复执行。
    # 离线模式（alembic upgrade --sql）不执行数据语句、execute() 返回 None，
    # 该模式仅用于核对 DDL，取不到行时跳过回填。
    bind = op.get_bind()
    result = bind.execute(
        sa.text("SELECT id, content FROM note WHERE body IS NULL")
    )
    rows = result.fetchall() if result is not None else []
    for row in rows:
        rid, content = row[0], row[1]
        if not content:
            continue
        bind.execute(
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

    op.create_table(
        "note_link",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "source_id",
            sa.Uuid(),
            sa.ForeignKey("note.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_id",
            sa.Uuid(),
            sa.ForeignKey("note.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("source_id", "target_id", name="uq_note_link_src_tgt"),
    )
    op.create_index("ix_note_link_source_id", "note_link", ["source_id"])
    op.create_index("ix_note_link_target_id", "note_link", ["target_id"])

    op.create_table(
        "note_draft",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "owner_id",
            sa.Uuid(),
            sa.ForeignKey("user.id"),
            nullable=False,
        ),
        sa.Column(
            "note_id",
            sa.Uuid(),
            sa.ForeignKey("note.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column(
            "body",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "saved_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("owner_id", "note_id", name="uq_note_draft_owner_note"),
    )
    op.create_index("ix_note_draft_owner_note", "note_draft", ["owner_id", "note_id"])
    op.execute(
        "CREATE UNIQUE INDEX uq_note_draft_new ON note_draft "
        "(owner_id) WHERE note_id IS NULL"
    )

    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_index(
        "ix_note_plain_text_trgm",
        "note",
        ["plain_text"],
        postgresql_using="gin",
        postgresql_ops={"plain_text": "gin_trgm_ops"},
    )


def downgrade() -> None:
    """回滚：按 upgrade 的逆序撤销索引、表与列"""
    op.execute("DROP INDEX IF EXISTS ix_note_plain_text_trgm")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
    op.execute("DROP INDEX IF EXISTS uq_note_draft_new")
    op.drop_index("ix_note_draft_owner_note", table_name="note_draft")
    op.drop_table("note_draft")
    op.drop_index("ix_note_link_target_id", table_name="note_link")
    op.drop_index("ix_note_link_source_id", table_name="note_link")
    op.drop_table("note_link")
    op.drop_column("note", "restricted_tags")
    op.drop_column("note", "plain_text")
    op.drop_column("note", "body")
