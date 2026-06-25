"""可见性查询辅助。

为 Form/Vote/Topology 等资源的列表查询构建可见性过滤条件，
使非 owner 用户也能看到 public / restricted（被授权）资源。

与 app.core.permissions.check_visibility 互补：
- permissions.check_visibility：加载后的逐项 Python 校验（含标签匹配）
- 本模块 check_visibility：DB 查询层过滤，用于 list_* 分页查询
"""

from __future__ import annotations

import uuid

from sqlalchemy import ColumnElement, or_
from sqlalchemy.orm import DeclarativeBase


def check_visibility(
    model_cls: type[DeclarativeBase], user_id: uuid.UUID
) -> ColumnElement[bool]:
    """构建列表查询的可见性过滤条件。

    匹配以下任一条件的资源：
      - visibility == "public"（所有人可见）
      - owner_id == user_id（owner 始终可见自己的资源）
      - visibility == "restricted" 且 user_id 存在于 restricted_users JSON 数组

    Args:
        model_cls: 模型类，需有 visibility / owner_id / restricted_users 列
        user_id: 当前用户 ID

    Returns:
        可加入 select().where() 的 SQLAlchemy 布尔表达式
    """
    return or_(
        model_cls.visibility == "public",  # type: ignore[attr-defined]
        model_cls.owner_id == user_id,  # type: ignore[attr-defined]
        (model_cls.visibility == "restricted")  # type: ignore[attr-defined]
        & model_cls.restricted_users.contains([str(user_id)]),  # type: ignore[attr-defined]
    )
