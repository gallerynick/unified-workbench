"""系统更新 API，支持仓库地址配置与验证、数据重置"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import json

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import require_admin
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
async def api_check_update(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    result = await check_update(db)
    return {"code": 0, "msg": "", "data": result}


@router.get("/repo")
async def api_get_repo(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    repo = await get_github_repo(db)
    return {"code": 0, "msg": "", "data": {"repo": repo}}


@router.put("/repo")
async def api_set_repo(
    config: RepoConfig,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
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
async def api_get_token(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    token = await get_github_token(db)
    masked = token[:4] + "****" + token[-4:] if len(token) > 8 else ""
    return {"code": 0, "msg": "", "data": {"token": masked, "has_token": bool(token)}}


@router.put("/token")
async def api_set_token(
    config: TokenConfig,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    await set_github_token(db, config.token)
    return {"code": 0, "msg": "GitHub Token 已保存", "data": None}


class ResetRequest(BaseModel):
    """数据重置请求"""
    keep_files: bool = True
    password: str = ""


@router.post("/reset")
async def api_reset_system(
    request: ResetRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    """重置系统：删除所有数据，需要密码验证，可选保留文件"""
    from sqlalchemy import text

    settings = get_settings()

    # 0. 验证管理员密码
    from app.core.security import verify_password
    result = await db.execute(text("SELECT password_hash FROM \"user\" WHERE username = 'admin'"))
    row = result.fetchone()
    if not row or not verify_password(request.password, row[0]):
        return {"code": 1, "msg": "密码错误", "data": None}

    # 1. 删除所有表的数据（按依赖顺序，包括所有用户）
    tables = [
        "vote_record", "vote", "content",
        "file_share", "form_response", "form",
        "calendar_event", "note", "inventory", "contact",
        "reminder", "budget", "subscription",
        "task", "template", "secret", "secret_category",
        "topology", "stream_room",
        "announcement", "notification",
        "refresh_token", "user_tag", "system_config",
        "\"user\"",  # 删除所有用户包括管理员
    ]
    for table in tables:
        await db.execute(text(f"DELETE FROM {table}"))
    await db.flush()

    # 2. 删除文件（如果不保留）
    if not request.keep_files:
        import shutil
        data_dir = settings.FILE_STORAGE_PATH
        try:
            shutil.rmtree(data_dir, ignore_errors=True)
        except Exception:
            pass

    # 3. 重建初始管理员（seed），用户通过初始化页面修改密码
    from app.utils.seed import create_initial_admin
    await create_initial_admin(db)
    await db.commit()

    return {
        "code": 0,
        "msg": "系统已重置，所有用户已被清除" + ("（文件已保留）" if request.keep_files else ""),
        "data": None,
    }


class TestNotificationRequest(BaseModel):
    channel: str  # 'feishu' | 'dingtalk' | 'email' | 'wecom'


@router.post("/test-notification")
async def test_notification(
    request: TestNotificationRequest,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    """测试通知渠道"""
    from app.services.system_config import get_config
    from app.services.notification.feishu_channel import FeishuChannel
    from app.services.notification.dingtalk_channel import DingTalkChannel
    from app.services.notification.email_channel import EmailChannel
    from app.services.notification.wecom_channel import WeComChannel

    config = await get_config(db, "notification")
    if not config:
        raise HTTPException(status_code=400, detail="通知配置未找到")

    channel_map = {
        "feishu": (FeishuChannel, "feishu_webhook_url"),
        "dingtalk": (DingTalkChannel, "dingtalk_webhook_url"),
        "email": (EmailChannel, None),
        "wecom": (WeComChannel, "wecom_webhook_url"),
    }

    if request.channel not in channel_map:
        raise HTTPException(status_code=400, detail=f"未知通知渠道: {request.channel}")

    channel_cls, url_key = channel_map[request.channel]

    if url_key is not None:
        webhook_url = config.get(url_key, "")
        if not webhook_url:
            raise HTTPException(status_code=400, detail=f"{request.channel} Webhook 地址未配置，请先保存配置")
        channel = channel_cls(webhook_url=webhook_url)
    else:
        smtp_host = config.get("smtp_host", "")
        if not smtp_host:
            raise HTTPException(status_code=400, detail="SMTP 服务器未配置，请先保存配置")
        channel = channel_cls(
            smtp_host=smtp_host,
            smtp_port=config.get("smtp_port", 587),
            smtp_user=config.get("smtp_user", ""),
            smtp_password=config.get("smtp_password", ""),
            use_tls=config.get("smtp_use_tls", True),
        )

    success = await channel.send(
        user_ids=["test"],
        title="一站式工作台 - 测试通知",
        content=f"这是一条来自 {request.channel} 渠道的测试通知。如果您收到此消息，说明通知配置正确。",
    )

    if success:
        return {"code": 0, "msg": f"{request.channel} 测试通知发送成功", "data": None}
    else:
        raise HTTPException(status_code=500, detail=f"{request.channel} 测试通知发送失败，请检查配置")
