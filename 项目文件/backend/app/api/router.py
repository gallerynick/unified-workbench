"""API 路由聚合"""

from fastapi import APIRouter

from app.api.audit import router as audit_router
from app.api.announcements import router as announcements_router
from app.api.auth import router as auth_router
from app.api.backups import router as backups_router
from app.api.calendar_events import router as calendar_events_router
from app.api.content import router as content_router
from app.api.contacts import router as contacts_router
from app.api.files import router as files_router
from app.api.finance import router as finance_router
from app.api.forms import router as forms_router
from app.api.health import router as health_router
from app.api.inventory import router as inventory_router
from app.api.notes import router as notes_router
from app.api.project_documents import router as project_documents_router
from app.api.records import router as records_router
from app.api.reminders import router as reminders_router
from app.api.secret_categories import router as secret_categories_router
from app.api.secrets import router as secrets_router
from app.api.system_config import router as system_config_router
from app.api.tags import router as tags_router
from app.api.tasks import router as tasks_router
from app.api.templates import router as templates_router
from app.api.topology import router as topology_router
from app.api.notifications import router as notifications_router
from app.api.stream import router as stream_router
from app.api.system import router as system_router
from app.api.users import router as users_router
from app.api.votes import router as votes_router

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
api_router.include_router(secret_categories_router, prefix="/secret-categories", tags=["密钥分类"])
api_router.include_router(system_config_router, prefix="/system-config", tags=["系统配置"])
api_router.include_router(audit_router, prefix="/audit-logs", tags=["审计日志"])
api_router.include_router(backups_router, prefix="/backups", tags=["备份管理"])
api_router.include_router(finance_router, prefix="/finance", tags=["财务管理"])
api_router.include_router(tasks_router, prefix="/tasks", tags=["任务管理"])
api_router.include_router(contacts_router, prefix="/contacts", tags=["客户管理"])
api_router.include_router(inventory_router, prefix="/inventory", tags=["物品管理"])
api_router.include_router(calendar_events_router, prefix="/calendar", tags=["日历"])
api_router.include_router(votes_router, prefix="/votes", tags=["投票"])
api_router.include_router(stream_router, prefix="/stream", tags=["推流配置"])
api_router.include_router(forms_router, prefix="/forms", tags=["表单"])
api_router.include_router(announcements_router, prefix="/announcements", tags=["公告"])
api_router.include_router(notes_router, prefix="/notes", tags=["笔记"])
api_router.include_router(project_documents_router, prefix="/project-documents", tags=["项目文档"])
api_router.include_router(tags_router, prefix="/tags", tags=["标签管理"])
api_router.include_router(topology_router, prefix="/topologies", tags=["拓扑管理"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["通知"])
api_router.include_router(system_router)
