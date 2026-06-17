"""内容-文件关联模型"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.content import Content
    from app.models.file import File


class ContentFile(Base):
    """内容-文件关联表"""

    __tablename__ = "content_file"

    content_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("content.id"), primary_key=True
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("file.id"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    # 关系
    content: Mapped[Content] = relationship("Content", back_populates="files")
    file: Mapped[File] = relationship("File")
