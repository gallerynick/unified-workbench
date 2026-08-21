"""项目提案评论 Pydantic 模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectProposalCommentCreate(BaseModel):
    """创建项目提案评论请求"""

    proposal_id: uuid.UUID
    content: str


class ProjectProposalCommentResponse(BaseModel):
    """项目提案评论响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    proposal_id: uuid.UUID
    creator_id: uuid.UUID
    content: str
    created_at: datetime


class ProjectProposalCommentListResponse(BaseModel):
    """项目提案评论列表响应"""

    items: list[ProjectProposalCommentResponse]
    total: int