"""用户偏好设置 Schema"""

from pydantic import BaseModel, Field


class UserPreferenceUpdate(BaseModel):
    """更新用户偏好的请求体"""

    page_zoom: str = Field(
        default="100",
        pattern=r"^(90|95|100|105|110)$",
        description="页面缩放比例：90=90%, 95=95%, 100=标准, 105=105%, 110=110%",
    )
    theme_mode: str = Field(
        default="system",
        pattern=r"^(light|dark|system)$",
        description="主题模式：light=浅色, dark=深色, system=跟随系统",
    )
    # 允许多处同时登录。关闭时新登录会自动下线该用户的全部其他会话（单设备登录）。
    # 该值在服务端登录时读取，不能只存在前端本地，否则换设备登录即失效。
    # 可空：个性化页只改缩放与主题，不传此字段即保持原值，避免被重置回 True。
    allow_multiple_logins: bool | None = Field(
        default=None,
        description="允许多处同时登录；不传则保持原值",
    )


class UserPreferenceResponse(BaseModel):
    """用户偏好响应"""

    page_zoom: str = Field(default="100", description="页面缩放比例")
    theme_mode: str = Field(default="system", description="主题模式")
    allow_multiple_logins: bool = Field(
        default=True, description="允许多处同时登录"
    )