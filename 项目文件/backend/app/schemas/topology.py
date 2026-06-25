"""拓扑管理 Schema"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# 允许的节点类型与状态，与前端 TopologyNode.type / status 对齐
VALID_NODE_TYPES = {"router", "switch", "server", "firewall", "device", "cloud"}
VALID_NODE_STATUS = {"online", "offline", "warning"}
VALID_TOPOLOGY_TYPES = {"device", "network", "custom"}


class TopologyCreate(BaseModel):
    """创建拓扑请求"""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    topology_type: str = Field(default="custom", pattern="^(device|network|custom)$")
    nodes: list[dict] = Field(default_factory=list)
    edges: list[dict] = Field(default_factory=list)
    visibility: Literal["public", "private", "restricted"] = "private"
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None


class TopologyUpdate(BaseModel):
    """更新拓扑请求"""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    topology_type: str | None = Field(default=None, pattern="^(device|network|custom)$")
    nodes: list[dict] | None = None
    edges: list[dict] | None = None


class TopologyResponse(BaseModel):
    """拓扑响应"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    topology_type: str
    nodes: list[dict]
    edges: list[dict]
    owner_id: uuid.UUID
    visibility: str
    restricted_users: list[str] | None = None
    restricted_tags: list[str] | None = None
    created_at: datetime
    updated_at: datetime


class TopologyListResponse(BaseModel):
    """拓扑列表响应"""

    items: list[TopologyResponse]
    total: int