# 多阶段构建 - 后端 Dockerfile
FROM python:3.11-slim AS builder

WORKDIR /build

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY pyproject.toml .

# 安装 Python 依赖（使用清华镜像加速）
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple --prefix=/install .

# 生产阶段
FROM python:3.11-slim

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制依赖
COPY --from=builder /install /usr/local

# 创建非 root 用户
RUN groupadd -r workbench && useradd -r -g workbench -d /app -s /sbin/nologin workbench

# 复制应用代码
COPY . .

# 切换到非 root 用户
USER workbench

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# 启动命令（先运行迁移再启动）
CMD ["sh", "-c", "cd /app && PYTHONPATH=/app python -c \"from sqlalchemy import create_engine; from app.core.config import get_settings; from app.core.database import Base; from app.models import *; settings = get_settings(); url = settings.DATABASE_URL.replace('+asyncpg', '+psycopg2'); engine = create_engine(url); Base.metadata.create_all(engine)\" && PYTHONPATH=/app uvicorn app.main:app --host 0.0.0.0 --port 8000"]
