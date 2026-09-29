"""服务启动时的建表与增量迁移（幂等，可重复执行）。

部署链路：backend/Dockerfile 的 CMD 先跑本脚本，再启动 uvicorn。

历史背景
--------
线上库由 Base.metadata.create_all 首次建表，未初始化 alembic_version，
因此 alembic upgrade head 不会自动执行。本文件是唯一的结构演进入口。

原先所有增量变更都以手工幂等 SQL 在此重复 alembic/versions 下的迁移，
已产生漂移（alembic 中 22 处 ADD COLUMN 只抄了 7 处，另有 027 迁移使用了
复数表名导致整段从未生效）。现改为三层策略：

1. **CREATE TYPE**（在 create_all 之前）
   PG 枚举类型只能由 DDL 创建——模型里写的是 create_type=False，
   create_all 不会创建枚举类型。缺这一步时全新库连第一张表都建不出来
   （type "userrole" does not exist）。枚举类型从模型元数据动态派生，
   新增枚举无需在此维护。

2. **动态补列**（在 create_all 之后）
   逐表对比模型元数据与实际库列集合，自动补齐缺失列，包含默认值、
   NOT NULL、外键。新增表 / 新增列从此只需写模型即可生效，
   alembic 里的 ADD COLUMN 不再需要在此手工抄写。

3. **手工特例**（动态对比无法表达的部分）
   存量数据回填、列改名、模型未声明的索引、废弃列删除。
   这些必须显式写出，并保留幂等分支。
"""

from __future__ import annotations

import json
import sys
from collections.abc import Iterable

import sqlalchemy as sa
from sqlalchemy import create_engine

from app.core.config import get_settings
from app.core.database import Base

# 显式导入全部模型，确保 Base.metadata 完整（与 Dockerfile 原有逻辑一致）
from app.models import *  # noqa: F401, F403


# ══════════════════════════════════════════════════════════════════════
# 第一层：PG 枚举类型（必须在 create_all 之前）
# ══════════════════════════════════════════════════════════════════════

def _iter_enum_types() -> Iterable[tuple[str, list[str]]]:
    """从模型元数据派生所有 native PG 枚举类型。

    模型里写 Enum(..., create_type=False) 表示不交由 create_all 创建，
    因此必须由本函数显式 CREATE TYPE。去重后按类型名输出。
    """
    seen: dict[str, list[str]] = {}
    for table in Base.metadata.tables.values():
        for col in table.columns:
            ctype = col.type
            if isinstance(ctype, sa.Enum) and ctype.native_enum and ctype.name:
                seen.setdefault(ctype.name, list(ctype.enums))
    return sorted(seen.items())


def _existing_enum_types(conn: sa.engine.Connection) -> set[str]:
    """查询 public schema 下已存在的枚举类型名。"""
    rows = conn.execute(
        sa.text(
            "SELECT typname FROM pg_type WHERE typcategory = 'E' "
            "AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')"
        )
    ).all()
    return {r[0] for r in rows}


def _create_enum_types(conn: sa.engine.Connection) -> int:
    """创建缺失的 PG 枚举类型，返回创建的类型数量。

    PostgreSQL 的 CREATE TYPE 不支持 IF NOT EXISTS 子句（与 CREATE EXTENSION
    不同），因此先查 pg_type 再建。
    """
    existing = _existing_enum_types(conn)
    created = 0
    for name, enums in _iter_enum_types():
        if name in existing:
            continue
        values = ", ".join("'" + str(v).replace("'", "''") + "'" for v in enums)
        conn.execute(sa.text(f'CREATE TYPE {_quote(name)} AS ENUM ({values})'))
        created += 1
    return created


# ══════════════════════════════════════════════════════════════════════
# 第二层：动态补列
# ══════════════════════════════════════════════════════════════════════

# NOT NULL 且无 server_default 的列无法用单条 ADD COLUMN 完成（已有行取不到值），
# 需要「先按 NULL 加列 → 回填存量 → SET NOT NULL」三步。这里声明回填值：
# 优先按 (表, 列) 显式覆盖（语义无法从类型推断的），否则按类型兜底。
_BACKFILL_DEFAULTS: dict[tuple[str, str], str] = {
    # servers.hardware_specs 的 Python 侧 default=list，语义是数组而非对象
    ("servers", "hardware_specs"): "'[]'::jsonb",
}

_TYPE_BACKFILL_DEFAULTS: dict[str, str] = {
    "JSON": "'{}'::jsonb",
    "JSONB": "'{}'::jsonb",
    "Boolean": "false",
    "Integer": "0",
    "BigInteger": "0",
    "SmallInteger": "0",
    "Float": "0",
    "Numeric": "0",
    "String": "''",
    "Text": "''",
    "LargeBinary": "'\\x'::bytea",
    "UUID": "gen_random_uuid()",
}


def _quote(name: str) -> str:
    """PG 标识符引用。标识符全部来自模型元数据，不含用户输入。"""
    return '"' + name.replace('"', '""') + '"'


def _backfill_default(table_name: str, col_name: str, col_type: sa.types.TypeEngine) -> str | None:
    """取 NOT NULL 无默认值列的回填值；无法推断时返回 None。"""
    if (table_name, col_name) in _BACKFILL_DEFAULTS:
        return _BACKFILL_DEFAULTS[(table_name, col_name)]
    return _TYPE_BACKFILL_DEFAULTS.get(type(col_type).__name__)


def _foreign_key_clause(col: sa.Column) -> str:
    """生成 REFERENCES 子句（含 ON DELETE）。无外键时返回空串。"""
    parts: list[str] = []
    for fk in col.foreign_keys:
        target = fk.column
        ref = f"REFERENCES {_quote(target.table.name)}({_quote(target.name)})"
        ondelete = fk.options.get("ondelete")
        if ondelete:
            ref += f" ON DELETE {ondelete.upper()}"
        parts.append(ref)
    return " ".join(parts)


def _actual_columns(conn: sa.engine.Connection, table_name: str) -> set[str]:
    rows = conn.execute(
        sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t"
        ),
        {"t": table_name},
    ).all()
    return {r[0] for r in rows}


def _sync_missing_columns(conn: sa.engine.Connection) -> list[str]:
    """对比模型元数据与实际库，补齐缺失列。返回动作描述供审计。

    处理三类情况：
    1. 可空列 / 有 server_default 的可空列 → 单条 ADD COLUMN
    2. NOT NULL 且有 server_default → ADD COLUMN ... DEFAULT ... NOT NULL
    3. NOT NULL 且无 server_default → 三步（NULL 加列 → 回填 → SET NOT NULL）
    外键在能安全表达时一并创建（仅可空外键列，NOT NULL 外键无法推断目标行）。
    """
    dialect = conn.dialect
    actions: list[str] = []
    for table_name, table in sorted(Base.metadata.tables.items()):
        actual = _actual_columns(conn, table_name)
        for col in table.columns:
            if col.name in actual:
                continue

            ti = _quote(table_name)
            ci = _quote(col.name)
            col_type = col.type.compile(dialect=dialect)
            fk = _foreign_key_clause(col)
            sd = col.server_default

            # 情况 3：NOT NULL 且无默认值 → 三步回填
            if not col.nullable and sd is None:
                if fk:
                    actions.append(
                        f"跳过 {table_name}.{col.name}"
                        "（NOT NULL 外键无法推断目标行，需手工处理）"
                    )
                    continue
                default_sql = _backfill_default(table_name, col.name, col.type)
                if default_sql is None:
                    actions.append(
                        f"跳过 {table_name}.{col.name}"
                        "（NOT NULL 无默认值且类型未登记，需手工处理）"
                    )
                    continue
                conn.execute(sa.text(f"ALTER TABLE {ti} ADD COLUMN IF NOT EXISTS {ci} {col_type} {fk}"))
                conn.execute(sa.text(f"UPDATE {ti} SET {ci} = {default_sql} WHERE {ci} IS NULL"))
                conn.execute(sa.text(f"ALTER TABLE {ti} ALTER COLUMN {ci} SET NOT NULL"))
                actions.append(f"补齐 {table_name}.{col.name}（NOT NULL 回填 {default_sql}）")
                continue

            # 情况 1 / 2：单条 ADD COLUMN
            ddl = f"ALTER TABLE {ti} ADD COLUMN IF NOT EXISTS {ci} {col_type} {fk}"
            if sd is not None:
                ddl += f" DEFAULT {_default_literal(sd, dialect)}"
                if not col.nullable:
                    ddl += " NOT NULL"
            conn.execute(sa.text(ddl))
            actions.append(f"补齐 {table_name}.{col.name}")
    return actions


def _default_literal(sd: sa.schema.DefaultClause, dialect) -> str:
    """把 server_default 编译成 SQL 字面量。"""
    arg = sd.arg
    if isinstance(arg, str):
        return "'" + arg.replace("'", "''") + "'"
    if hasattr(arg, "text"):  # TextClause
        return arg.text
    return str(arg)  # func.now() -> "now()"


# ══════════════════════════════════════════════════════════════════════
# 工具：存量数据迁移（非结构变更）
# ══════════════════════════════════════════════════════════════════════

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
    """执行建表与全部增量迁移。"""
    settings = get_settings()
    url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")
    # pool_pre_ping：连接池里的陈旧连接（容器重启 / 网络抖动后）会导致
    # inspect 或首条查询无限挂起；开启后 SQLAlchemy 在取用前探测连接可用性。
    engine = create_engine(url, pool_pre_ping=True)

    # ── 第一层：枚举类型必须先于 create_all 存在 ──
    with engine.begin() as conn:
        enum_count = _create_enum_types(conn)
        conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))

    # 首次建表；已存在的表不会被改动
    Base.metadata.create_all(engine)

    with engine.begin() as conn:
        # ── 第二层：动态补齐缺失列 ──
        sync_actions = _sync_missing_columns(conn)
        for action in sync_actions:
            print(f"[startup_migrate]   {action}")

        # ── 第三层：手工特例 ──

        # 迁移 046：form 表物理列改名，按当前列状态分支，保证幂等
        form_cols = _actual_columns(conn, "form")
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

        # 迁移 028：servers 表 ram_gb/disk_gb 改名（列改名无法由元数据对比表达）
        servers_cols = _actual_columns(conn, "servers")
        if "ram_gb" in servers_cols:
            conn.execute(sa.text("ALTER TABLE servers RENAME COLUMN ram_gb TO ram_capacity"))
        if "disk_gb" in servers_cols:
            conn.execute(sa.text("ALTER TABLE servers RENAME COLUMN disk_gb TO disk_capacity"))

        # 迁移 047：note 表存量回填。列由第二层补齐，此处只回填数据
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

        # 迁移 051：笔记文件夹。新表由 create_all 创建，此处补建模型声明的索引
        conn.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_note_folder_owner_id "
                "ON note_folder (owner_id)"
            )
        )
        conn.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_note_folder_membership_folder_id "
                "ON note_folder_membership (folder_id)"
            )
        )

        # 废弃列删除：create_all 不会删列，需显式 ALTER。按列是否存在分支
        # 保证幂等；先删自引用外键再删 parent_id，顺序颠倒会因约束依赖失败
        note_cols = _actual_columns(conn, "note")
        if "parent_id" in note_cols:
            conn.execute(
                sa.text("ALTER TABLE note DROP CONSTRAINT IF EXISTS fk_note_parent")
            )
            conn.execute(sa.text("ALTER TABLE note DROP COLUMN parent_id"))
        if "category" in note_cols:
            conn.execute(sa.text("ALTER TABLE note DROP COLUMN category"))

        # 删除 link_relation 通用关联表（零消费者，项目内部关联已由外键覆盖）
        conn.execute(sa.text("DROP INDEX IF EXISTS ix_link_relation_source_type_source_id"))
        conn.execute(sa.text("DROP TABLE IF EXISTS link_relation"))

    print(
        f"[startup_migrate] 新建枚举类型 {enum_count} 个，"
        f"补齐列 {len(sync_actions)} 项，建表与增量迁移完成"
    )


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup_migrate] 失败：{exc}", file=sys.stderr)
        sys.exit(1)
