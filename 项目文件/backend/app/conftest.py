"""应用级 conftest：为 SQLite 测试注册 JSONB 兼容类型。"""

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    """将 PostgreSQL JSONB 在 SQLite 上编译为 JSON。"""
    return "JSON"
