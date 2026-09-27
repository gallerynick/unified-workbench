# 多阶段构建 - 后端 Dockerfile
FROM python:3.11-slim AS builder

WORKDIR /build

# 使用阿里云镜像加速 Debian 包下载
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.aliyun.com/debian|g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's|http://security.debian.org/debian-security|http://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY pyproject.toml .

# 先安装 PyTorch CPU-only（系统级，避免后续拉取 CUDA 版）
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# 再安装项目依赖（torch 已安装，funasr 不会重复拉取）
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple .

# 生产阶段
FROM python:3.11-slim

WORKDIR /app

# 使用阿里云镜像加速 Debian 包下载
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.aliyun.com/debian|g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's|http://security.debian.org/debian-security|http://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources

# 安装运行时依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制 Python 环境
COPY --from=builder /usr/local /usr/local

# 创建非 root 用户
RUN groupadd -r workbench && useradd -r -g workbench -d /home/workbench -s /sbin/nologin workbench

# 复制应用代码
COPY . .

# 创建 modelscope 缓存目录（ASR 模型下载）
RUN mkdir -p /home/workbench/.modelscope && chown -R workbench:workbench /home/workbench/.modelscope

# 切换到非 root 用户
USER workbench

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# 启动命令：建表与幂等增量迁移（见 app/startup_migrate.py）+ uvicorn 启动
CMD ["sh", "-c", "cd /app && PYTHONPATH=/app python app/startup_migrate.py && PYTHONPATH=/app uvicorn app.main:app --host 0.0.0.0 --port 8000"]
