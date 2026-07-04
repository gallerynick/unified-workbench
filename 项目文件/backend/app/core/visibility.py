"""可见性枚举 — 统一所有模型和 Schema 的 public/private/restricted 定义"""

from __future__ import annotations

import enum


class Visibility(str, enum.Enum):
    """可见性级别"""

    PUBLIC = "public"
    PRIVATE = "private"
    RESTRICTED = "restricted"
