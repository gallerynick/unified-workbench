"""API 路由聚合"""

from fastapi import APIRouter

from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.backups import router as backups_router
from app.api.content import router as content_router
from app.api.files import router as files_router
from app.api.health import router as health_router
from app.api.records import router as records_router
from app.api.reminders import router as reminders_router
from app.api.secrets import router as secrets_router
from app.api.system_config import router as system_config_router
from app.api.templates import router as templates_router
from app.api.users import router as users_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router, prefix="/auth", tags=["认证"])
api_router.include_router(users_router, prefix="/users", tags=["用户管理"])
api_router.include_router(content_router, prefix="/contents", tags=["内容管理"])
api_router.include_router(files_router, prefix="/files", tags=["文件管理"])
api_router.include_router(templates_router, prefix="/templates", tags=["模板管理"])
api_router.include_router(records_router, prefix="/records", tags=["记录管理"])
api_router.include_router(reminders_router, prefix="/reminders", tags=["提醒管理"])
api_router.include_router(secrets_router, prefix="/secrets", tags=["密钥管理"])
api_router.include_router(system_config_router, prefix="/system-config", tags=["系统配置"])
api_router.include_router(audit_router, prefix="/audit-logs", tags=["审计日志"])
api_router.include_router(backups_router, prefix="/backups", tags=["备份管理"])
