"""API 路由聚合"""

from fastapi import APIRouter

from app.api.announcements import router as announcements_router
from app.api.auth import router as auth_router
from app.api.backups import router as backups_router
from app.api.calendar_events import router as calendar_events_router
from app.api.contacts import router as contacts_router
from app.api.content import router as content_router
from app.api.data_export import router as data_export_router
from app.api.data_import import router as data_import_router
from app.api.file_shares import public_router as file_shares_public_router
from app.api.file_shares import router as file_shares_router
from app.api.finance import router as finance_router
from app.api.forms import router as forms_router
from app.api.health import router as health_router
from app.api.inventory import router as inventory_router
from app.api.link_relations import router as link_relations_router
from app.api.notes import router as notes_router
from app.api.notifications import router as notifications_router
from app.api.project_changes import router as project_changes_router
from app.api.project_events import router as project_events_router
from app.api.project_members import router as project_members_router
from app.api.project_meetings import router as project_meetings_router
from app.api.project_proposals import router as project_proposals_router
from app.api.project_todos import router as project_todos_router
from app.api.projects import router as projects_router

from app.api.reminders import router as reminders_router
from app.api.secret_categories import router as secret_categories_router
from app.api.secrets import router as secrets_router
from app.api.servers import router as servers_router
from app.api.services import router as services_router
from app.api.stream import router as stream_router
from app.api.stream_room import router as stream_room_router
from app.api.system import router as system_router
from app.api.system_config import router as system_config_router
from app.api.systems import router as systems_router
from app.api.tags import router as tags_router
from app.api.tasks import router as tasks_router
from app.api.templates import router as templates_router
from app.api.topology import router as topology_router
from app.api.user_notification_config import router as notification_config_router
from app.api.user_sessions import router as user_sessions_router
from app.api.users import router as users_router
from app.api.votes import router as votes_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router, prefix="/auth", tags=["认证"])
api_router.include_router(users_router, prefix="/users", tags=["用户管理"])
api_router.include_router(content_router, prefix="/contents", tags=["内容管理"])
api_router.include_router(file_shares_router, prefix="/file-shares", tags=["文件共享"])
api_router.include_router(file_shares_public_router)
api_router.include_router(templates_router, prefix="/templates", tags=["模板管理"])
api_router.include_router(reminders_router, prefix="/reminders", tags=["提醒管理"])
api_router.include_router(secrets_router, prefix="/secrets", tags=["密钥管理"])
api_router.include_router(secret_categories_router, prefix="/secret-categories", tags=["密钥分类"])
api_router.include_router(system_config_router, prefix="/system-config", tags=["系统配置"])
api_router.include_router(backups_router, prefix="/backups", tags=["备份管理"])
api_router.include_router(data_export_router, prefix="/transfer", tags=["数据迁转"])
api_router.include_router(data_import_router, prefix="/transfer", tags=["数据迁转"])
api_router.include_router(finance_router, prefix="/finance", tags=["财务管理"])
api_router.include_router(tasks_router, prefix="/tasks", tags=["任务管理"])
api_router.include_router(contacts_router, prefix="/contacts", tags=["客户管理"])
api_router.include_router(inventory_router, prefix="/inventory", tags=["物品管理"])
api_router.include_router(calendar_events_router, prefix="/calendar", tags=["日历"])
api_router.include_router(votes_router, prefix="/votes", tags=["投票"])
api_router.include_router(stream_router, tags=["推流配置"])
api_router.include_router(stream_room_router, prefix="/stream/rooms", tags=["直播间"])
api_router.include_router(forms_router, prefix="/forms", tags=["表单"])
api_router.include_router(announcements_router, prefix="/announcements", tags=["公告"])
api_router.include_router(notes_router, prefix="/notes", tags=["笔记"])
api_router.include_router(project_members_router, prefix="/project-members", tags=["项目成员"])
api_router.include_router(project_proposals_router, prefix="/project-proposals", tags=["项目提案"])
api_router.include_router(project_meetings_router, prefix="/project-meetings", tags=["项目会议"])
api_router.include_router(project_changes_router, prefix="/project-changes", tags=["项目变更"])
api_router.include_router(project_todos_router, prefix="/project-todos", tags=["项目待办"])
api_router.include_router(project_events_router, prefix="/project-events", tags=["项目事件"])
api_router.include_router(link_relations_router, prefix="/link-relations", tags=["关联关系"])
api_router.include_router(projects_router, prefix="/projects", tags=["项目文档"])
api_router.include_router(tags_router, prefix="/tags", tags=["标签管理"])
api_router.include_router(topology_router, prefix="/topologies", tags=["拓扑管理"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["通知"])
api_router.include_router(system_router)
api_router.include_router(servers_router, prefix="/servers", tags=["服务器管理"])
api_router.include_router(systems_router, prefix="/systems", tags=["系统管理"])
api_router.include_router(services_router, prefix="/services", tags=["服务管理"])
api_router.include_router(notification_config_router, prefix="/auth", tags=["个人通知配置"])
api_router.include_router(user_sessions_router, tags=["设备终端"])
