"""用户-标签关联模型"""

import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserTag(Base):
    """用户-标签多对多关联表"""

    __tablename__ = "user_tag"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("user.id"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tag.id"), primary_key=True
    )
