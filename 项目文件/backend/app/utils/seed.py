"""Seed script for initial admin user."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.user import User, UserRole, UserStatus

logger = logging.getLogger(__name__)


async def create_initial_admin(db: AsyncSession) -> None:
    """Create initial admin user if no admin exists.

    This function is idempotent - it will not create a duplicate admin if one already exists.
    Called on application startup.
    """
    settings = get_settings()

    result = await db.execute(
        select(User).where(User.username == settings.INITIAL_ADMIN_USERNAME).limit(1)
    )
    if result.scalar_one_or_none() is not None:
        logger.debug("Admin user already exists, skipping seed")
        return

    admin = User(
        username=settings.INITIAL_ADMIN_USERNAME,
        password_hash=hash_password(settings.INITIAL_ADMIN_PASSWORD),
        nickname="管理员",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add(admin)
    await db.commit()

    logger.info(f"Initial admin user '{admin.username}' created successfully")
