"""应用配置模块"""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置，从环境变量或 .env 文件加载"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # 应用配置
    APP_NAME: str = "一站式工作台"
    DEBUG: bool = False

    # 数据库配置
    DATABASE_URL: str = "postgresql+asyncpg://workbench:password@localhost:5432/unified_workbench"

    # Redis 配置
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT 配置
    SECRET_KEY: str = "change-this-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS 配置
    CORS_ORIGINS: str = "http://localhost,http://localhost:3000"

    # 初始管理员配置
    INITIAL_ADMIN_USERNAME: str = "admin"
    INITIAL_ADMIN_PASSWORD: str = "admin123"

    # 文件存储配置
    NAS_FILES_PATH: str = "/data/files"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB
    MAX_IMAGE_SIZE: int = 20 * 1024 * 1024  # 20MB
    THUMBNAIL_SIZE: int = 200  # 200x200

    # 加密配置
    ENCRYPTION_MASTER_KEY: str = "change-this-32-byte-key-in-prod!"

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """验证数据库 URL 使用 asyncpg 驱动"""
        if not v.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL 必须使用 postgresql+asyncpg:// 前缀")
        return v


@lru_cache
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()
