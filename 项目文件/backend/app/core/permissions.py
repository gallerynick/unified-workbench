"""权限与可见性工具函数。

提供三态可见性检查模型，用于 P1+ 阶段的文件/内容可见性控制。
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User


def check_visibility(
    user: User,
    visibility: str,
    owner_id: uuid.UUID,
    restricted_users: set[uuid.UUID] | None = None,
    restricted_tags: set[str] | None = None,
) -> bool:
    """检查用户对资源的可见性。

    三态模型：
      - "public"     → 所有人可见
      - "private"    → 仅 owner 可见
      - "restricted" → owner + restricted_users 中的用户 + 拥有 restricted_tags 中任意标签的用户

    Args:
        user: 当前请求用户
        visibility: 可见性类型 ("public" | "private" | "restricted")
        owner_id: 资源所有者的用户 ID
        restricted_users: 被授权查看的用户 ID 集合（仅 restricted 有效）
        restricted_tags: 被授权查看的标签名称集合（仅 restricted 有效）

    Returns:
        True 表示用户可以查看该资源
    """
    if visibility == "public":
        return True

    if visibility == "private":
        return user.id == owner_id

    if visibility == "restricted":
        # owner 始终可见
        if user.id == owner_id:
            return True
        # 检查用户是否在受限用户列表中
        if restricted_users and user.id in restricted_users:
            return True
        # 检查用户是否拥有任意受限标签
        if restricted_tags and user.tags:
            user_tag_names = {tag.name for tag in user.tags}
            if user_tag_names & restricted_tags:
                return True
        return False

    # 未知可见性类型，默认不可见
    return False
