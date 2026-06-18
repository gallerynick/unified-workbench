"""Celery 异步任务配置"""

from celery import Celery

from app.core.config import get_settings
from app.tasks.backup import scheduled_backup  # noqa: F401
from app.tasks.reminder import check_due_reminders  # noqa: F401

settings = get_settings()

celery_app = Celery(
    "unified_workbench",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.reminder",
        "app.tasks.backup",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 单任务最大执行时间 1 小时
    worker_max_tasks_per_child=1000,
)

# 自动发现任务
celery_app.autodiscover_tasks()

# Beat 调度配置
celery_app.conf.beat_schedule = {
    'check-due-reminders': {
        'task': 'app.tasks.reminder.check_due_reminders',
        'schedule': 60.0,
    },
    'scheduled-backup': {
        'task': 'app.tasks.backup.scheduled_backup',
        'schedule': 86400.0,
    },
}
