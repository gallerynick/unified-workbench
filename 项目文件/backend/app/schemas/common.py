"""通用响应模型"""

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")

# 字段校验上限基准。
#
# 规则：校验上限不得超过数据库列的存储上限，否则请求能通过 Pydantic 却被
# asyncpg 拒绝（int4 溢出 / varchar 超长），最终抛未捕获异常返回 500，前端
# 只看到笼统的 "Request failed"。各 schema 的 max_length / le 必须与此处一致。
INT4_MAX = 2_147_483_647  # PostgreSQL Integer(int4) 上限
MAX_CPU_CORES = 4096  # 单台服务器 CPU 核心数业务上限
MAX_PORT = 65535  # TCP/UDP 端口协议上限


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
