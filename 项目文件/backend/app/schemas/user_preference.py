"""用户偏好设置 Schema"""

from pydantic import BaseModel, Field


class UserPreferenceUpdate(BaseModel):
    """更新用户偏好的请求体"""

    page_zoom: str = Field(
        default="100",
        pattern=r"^(100|95|90)$",
        description="页面缩放比例：100=标准, 95=95%, 90=90%",
    )
    theme_mode: str = Field(
        default="system",
        pattern=r"^(light|dark|system)$",
        description="主题模式：light=浅色, dark=深色, system=跟随系统",
    )


class UserPreferenceResponse(BaseModel):
    """用户偏好响应"""

    page_zoom: str = Field(default="100", description="页面缩放比例")
    theme_mode: str = Field(default="system", description="主题模式")