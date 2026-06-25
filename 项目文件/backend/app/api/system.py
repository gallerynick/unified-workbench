"""系统更新 API，支持仓库地址配置与验证"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.updater import (
    check_update,
    get_github_repo,
    perform_update,
    set_github_repo,
    validate_repo,
)

router = APIRouter(prefix="/system", tags=["system"])


class RepoConfig(BaseModel):
    repo: str


@router.get("/check-update")
async def api_check_update(db: AsyncSession = Depends(get_db)):
    result = await check_update(db)
    return {"code": 0, "msg": "", "data": result}


@router.post("/update")
async def api_perform_update(db: AsyncSession = Depends(get_db)):
    result = await perform_update(db)
    return {"code": 0, "msg": "", "data": result}


@router.get("/repo")
async def api_get_repo(db: AsyncSession = Depends(get_db)):
    repo = await get_github_repo(db)
    return {"code": 0, "msg": "", "data": {"repo": repo}}


@router.put("/repo")
async def api_set_repo(config: RepoConfig, db: AsyncSession = Depends(get_db)):
    # 验证仓库格式
    parts = config.repo.split("/")
    if len(parts) != 2:
        return {"code": 1, "msg": "仓库地址格式错误，应为 owner/repo", "data": None}

    # 验证仓库是否为本应用
    validation = await validate_repo(config.repo)
    if not validation["valid"]:
        return {"code": 1, "msg": validation["error"], "data": None}

    await set_github_repo(db, config.repo)
    return {"code": 0, "msg": "仓库地址已更新", "data": {"repo": config.repo}}
