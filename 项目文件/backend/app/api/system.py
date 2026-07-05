"""系统更新 API，支持仓库地址配置与验证、数据重置"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, Base
from app.services.updater import (
    check_update,
    get_github_repo,
    get_github_token,
    set_github_repo,
    set_github_token,
    validate_repo,
)

router = APIRouter(prefix="/system", tags=["system"])


class RepoConfig(BaseModel):
    repo: str


class TokenConfig(BaseModel):
    token: str


@router.get("/check-update")
async def api_check_update(db: AsyncSession = Depends(get_db)):
    result = await check_update(db)
    return {"code": 0, "msg": "", "data": result}


@router.get("/repo")
async def api_get_repo(db: AsyncSession = Depends(get_db)):
    repo = await get_github_repo(db)
    return {"code": 0, "msg": "", "data": {"repo": repo}}


@router.put("/repo")
async def api_set_repo(config: RepoConfig, db: AsyncSession = Depends(get_db)):
    parts = config.repo.split("/")
    if len(parts) != 2:
        return {"code": 1, "msg": "仓库地址格式错误，应为 owner/repo", "data": None}

    token = await get_github_token(db)
    validation = await validate_repo(config.repo, token)
    if not validation["valid"]:
        return {"code": 1, "msg": validation["error"], "data": None}

    await set_github_repo(db, config.repo)
    return {"code": 0, "msg": "仓库地址已更新", "data": {"repo": config.repo}}


@router.get("/token")
async def api_get_token(db: AsyncSession = Depends(get_db)):
    token = await get_github_token(db)
    masked = token[:4] + "****" + token[-4:] if len(token) > 8 else ""
    return {"code": 0, "msg": "", "data": {"token": masked, "has_token": bool(token)}}


@router.put("/token")
async def api_set_token(config: TokenConfig, db: AsyncSession = Depends(get_db)):
    await set_github_token(db, config.token)
    return {"code": 0, "msg": "GitHub Token 已保存", "data": None}


class ResetRequest(BaseModel):
    """数据重置请求"""
    keep_files: bool = True  # 默认保留文件


@router.post("/reset")
async def api_reset_system(
    request: ResetRequest,
    db: AsyncSession = Depends(get_db),
):
    """重置系统：删除所有数据，可选保留文件"""
    from sqlalchemy import text

    # 1. 删除所有表的数据（按依赖顺序）
    tables = [
        "stream_room", "topology", "vote_record", "vote", "content_file",
        "content", "file", "folder", "form_response", "form",
        "calendar_event", "note", "inventory", "contact",
        "project_document", "reminder", "budget", "subscription",
        "task", "record", "template", "secret", "secret_category",
        "announcement", "notification", "audit_log",
        "user_tag", "system_config",
    ]
    for table in tables:
        await db.execute(text(f"DELETE FROM {table}"))
    # 用户表需要排除初始管理员
    await db.execute(text(
        "DELETE FROM \"user\" WHERE username != 'admin'"
    ))
    await db.flush()

    # 2. 恢复初始管理员状态
    await db.execute(text(
        "UPDATE \"user\" SET password_hash = '', nickname = '管理员' WHERE username = 'admin'"
    ))

    # 3. 删除文件（如果不保留）
    if not request.keep_files:
        import shutil
        data_dir = "/data/files"
        try:
            shutil.rmtree(data_dir, ignore_errors=True)
        except Exception:
            pass

    # 4. 重新创建初始管理员（通过 seed）
    from app.utils.seed import create_initial_admin
    await create_initial_admin(db)

    return {
        "code": 0,
        "msg": "系统已重置" + ("，文件已保留" if request.keep_files else "，所有数据已清除"),
        "data": None,
    }
