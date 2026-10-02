"""PostgreSQL 转储与恢复服务（pg_dump / pg_restore 子进程封装）

数据备份与数据迁转共用本模块。统一从 settings.DATABASE_URL 解析连接参数，
密码通过 PGPASSWORD 环境变量传递（不进命令行参数，避免 ps 输出泄露）。

背景：backend 镜像基于 python:3.11-slim，默认不含 PostgreSQL 客户端，
缺 pg_dump / pg_restore 时备份与迁转都会抛 FileNotFoundError，
因此 Dockerfile 运行时依赖中加了 postgresql-client。
"""

from __future__ import annotations

import asyncio
import os
from urllib.parse import unquote, urlparse

from app.core.config import get_settings


def _conn_params() -> dict[str, str]:
    """从 DATABASE_URL 解析连接参数。

    示例：postgresql+asyncpg://workbench:secret@db:5432/unified_workbench
    返回 host/port/user/password/dbname 五项。
    """
    raw = get_settings().DATABASE_URL.replace("+asyncpg", "")
    parsed = urlparse(raw)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": unquote(parsed.username or "postgres"),
        "password": unquote(parsed.password or ""),
        "dbname": (parsed.path or "/").lstrip("/"),
    }


def _subprocess_env() -> dict[str, str]:
    """构造子进程环境，注入 PGPASSWORD。"""
    env = dict(os.environ)
    env["PGPASSWORD"] = _conn_params()["password"]
    return env


async def _run(args: list[str], input_data: bytes | None = None) -> tuple[int, str, str]:
    """执行外部命令，返回 (returncode, stdout, stderr)。"""
    # stdin 不传数据时必须用 DEVNULL：子进程继承父进程 stdin 会让 pg_dump
    # 在读提示时挂起（生产环境父进程 stdin 常是管道或 TTY）。
    stdin_mode = (
        asyncio.subprocess.PIPE if input_data is not None else asyncio.subprocess.DEVNULL
    )
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdin=stdin_mode,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=_subprocess_env(),
    )
    out, err = await proc.communicate(input=input_data)
    return (
        proc.returncode if proc.returncode is not None else -1,
        out.decode(errors="replace"),
        err.decode(errors="replace"),
    )


def _q(ident: str) -> str:
    """引用 SQL 标识符（库名来自本地配置，仍统一引用以防特殊字符）。"""
    return '"' + ident.replace('"', '""') + '"'


async def dump_database(dest_path: str) -> None:
    """pg_dump -Fc 全库转储到 dest_path（含 schema、枚举类型、扩展、数据）。"""
    p = _conn_params()
    rc, _out, err = await _run([
        "pg_dump",
        "-h", p["host"],
        "-p", p["port"],
        "-U", p["user"],
        "-d", p["dbname"],
        "-Fc",
        "-f", dest_path,
    ])
    if rc != 0:
        raise RuntimeError(f"pg_dump 失败 (exit={rc}): {err.strip()[:500]}")


async def restore_database(dump_path: str, dbname: str | None = None) -> None:
    """pg_restore 恢复转储到目标库。

    目标库应为空库（调用方先 drop/create）。--exit-on-error 保证出错即停，
    --no-owner --no-acl 使对象归当前连接用户所有、不恢复旧角色授权。

    不使用 --single-transaction：该选项在 pg_restore 17 中会执行
    'SET transaction_timeout = 0'，而 PostgreSQL 15 服务端不认识该参数。
    非原子恢复可接受——失败时由上层快照回退兜底。
    """
    p = _conn_params()
    target = dbname or p["dbname"]
    rc, _out, err = await _run([
        "pg_restore",
        "-h", p["host"],
        "-p", p["port"],
        "-U", p["user"],
        "-d", target,
        "--exit-on-error",
        "--no-owner",
        "--no-acl",
        dump_path,
    ])
    if rc != 0:
        raise RuntimeError(f"pg_restore 失败 (exit={rc}): {err.strip()[:500]}")


async def drop_database(dbname: str | None = None) -> None:
    """DROP DATABASE ... WITH (FORCE)，在 postgres 维护库上执行。

    WITH (FORCE) 先终止所有活跃连接（PG13+，本项目 PG15），
    否则会因连接占用而失败。
    """
    p = _conn_params()
    target = dbname or p["dbname"]
    rc, _out, err = await _run(
        [
            "psql", "-h", p["host"], "-p", p["port"], "-U", p["user"],
            "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1",
            "-c", f"DROP DATABASE IF EXISTS {_q(target)} WITH (FORCE);",
        ],
    )
    if rc != 0:
        raise RuntimeError(f"DROP DATABASE 失败 (exit={rc}): {err.strip()[:500]}")


async def create_database(dbname: str | None = None) -> None:
    """CREATE DATABASE。

    只执行 CREATE，不做 DROP：DROP 与 CREATE 必须分成两次独立调用。
    原因：psql 单次 -c 内的多条语句会被 PostgreSQL 包进一个隐式事务块，
    而 CREATE/DROP DATABASE 不允许在事务块内执行。
    """
    p = _conn_params()
    target = dbname or p["dbname"]
    rc, _out, err = await _run([
        "psql", "-h", p["host"], "-p", p["port"], "-U", p["user"],
        "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1",
        "-c", f"CREATE DATABASE {_q(target)};",
    ])
    if rc != 0:
        raise RuntimeError(f"CREATE DATABASE 失败 (exit={rc}): {err.strip()[:500]}")


async def table_count(dbname: str | None = None) -> int:
    """查询 public schema 下表数量（用于 manifest 元数据）。"""
    p = _conn_params()
    target = dbname or p["dbname"]
    rc, out, _err = await _run([
        "psql", "-h", p["host"], "-p", p["port"], "-U", p["user"],
        "-d", target, "-X", "-tAc",
        "SELECT count(*) FROM pg_tables WHERE schemaname='public';",
    ])
    if rc != 0:
        raise RuntimeError(f"查询表数量失败 (exit={rc})")
    return int(out.strip() or "0")
