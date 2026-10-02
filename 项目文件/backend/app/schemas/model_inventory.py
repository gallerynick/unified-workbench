"""模型清单 schema。

聚合两个引擎（Ollama、ModelScope）已下载的本地模型，统一给出引擎、用途类型、
体积与配置状态，供系统设置页做一张统一的模型清单。

按引擎分组展示，不合并成一个总量：两个引擎的模型分别住在两个命名卷里，
管理动作也不相同（Ollama 走 API，ModelScope 走缓存目录），合并总数没有意义。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# configured  = 当前配置正在使用
# available   = 已下载但当前配置未引用（Ollama 备用模型）
# orphan      = 已下载但不属于当前 ASR 配置的任何一个槽位（历史缓存）
# incomplete  = 缓存目录存在但没有实际内容
ModelStatus = Literal["configured", "available", "orphan", "incomplete"]


class ModelInventoryItem(BaseModel):
    """单个已下载模型。"""

    engine: str
    type_key: str
    model_type: str
    name: str
    repo_id: str | None = None
    bytes: int = 0
    status: ModelStatus = "configured"
    source: str = ""
    note: str | None = None


class EngineSummary(BaseModel):
    """单个引擎的汇总。"""

    engine: str
    engine_name: str
    bytes: int = 0
    count: int = 0


class ModelInventory(BaseModel):
    """模型清单快照。"""

    generated_at: str
    elapsed_ms: int
    total_bytes: int = 0
    engines: list[EngineSummary] = Field(default_factory=list)
    items: list[ModelInventoryItem] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
