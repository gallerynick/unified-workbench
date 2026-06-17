"""通用响应模型"""

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class UnifiedResponse(BaseModel, Generic[T]):
    """统一 API 响应格式

    所有 API 返回此格式：
    {
        "code": 0,      # 0=成功, 非0=错误
        "msg": "",       # 错误信息
        "data": {}       # 响应数据
    }
    """

    code: int = 0
    msg: str = ""
    data: T | None = None
