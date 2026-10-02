# 多阶段构建 - 后端 Dockerfile
FROM python:3.11-slim AS builder

WORKDIR /build

# Debian 源：使用清华镜像加速（原用的阿里云镜像站在本机网络下传输大索引会停顿）。
#
# 为什么必须同时调 apt 超时 —— 2026-09-30 部署中断的根因：
#   apt 按 xz → gz → 未压缩 的优先级依次尝试索引，且每个都走 by-hash 路径：
#     by-hash/SHA256/<.xz 的 sha256>  →  <...gz>  →  <...plain>
#   Debian 已不再发布「未压缩」索引（官方源、清华、中科大、阿里云全部 404，
#   但 Release 文件仍声明它）。于是压缩索引一旦下载超时，apt 回退到未压缩版
#   即秒收 404，并被当作致命错误（E: Failed to fetch）中断整个构建。
#   放宽超时 + 重试 + 关闭 HTTP 流水线（对有本地代理的环境更稳），
#   确保压缩索引能在超时前取回。
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's|http://security.debian.org/debian-security|http://mirrors.tuna.tsinghua.edu.cn/debian-security|g' /etc/apt/sources.list.d/debian.sources \
    && printf 'Acquire::IndexTargets::deb::Packages:: "no";\nAcquire::http::Timeout "600";\nAcquire::https::Timeout "600";\nAcquire::Retries "5";\nAcquire::http::Pipeline-Depth "0";\n' > /etc/apt/apt.conf.d/99-build-tuning

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY pyproject.toml .

# ASR 改用 onnxruntime 运行时（funasr-onnx / sherpa-onnx），不再安装 torch：
# torch CPU-only 约 656 MB，只为一套推理链路背着，换成 onnxruntime 约 60 MB。
# 安装项目依赖（funasr-onnx 不依赖 torch）
RUN pip install --no-cache-dir --retries 10 --timeout 120 \
        -i https://pypi.tuna.tsinghua.edu.cn/simple .

# 生产阶段
FROM python:3.11-slim

WORKDIR /app

# Debian 源：使用清华镜像加速（原用的阿里云镜像站在本机网络下传输大索引会停顿）。
#
# 为什么必须同时调 apt 超时 —— 2026-09-30 部署中断的根因：
#   apt 按 xz → gz → 未压缩 的优先级依次尝试索引，且每个都走 by-hash 路径：
#     by-hash/SHA256/<.xz 的 sha256>  →  <...gz>  →  <...plain>
#   Debian 已不再发布「未压缩」索引（官方源、清华、中科大、阿里云全部 404，
#   但 Release 文件仍声明它）。于是压缩索引一旦下载超时，apt 回退到未压缩版
#   即秒收 404，并被当作致命错误（E: Failed to fetch）中断整个构建。
#   放宽超时 + 重试 + 关闭 HTTP 流水线（对有本地代理的环境更稳），
#   确保压缩索引能在超时前取回。
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's|http://security.debian.org/debian-security|http://mirrors.tuna.tsinghua.edu.cn/debian-security|g' /etc/apt/sources.list.d/debian.sources \
    && printf 'Acquire::IndexTargets::deb::Packages:: "no";\nAcquire::http::Timeout "600";\nAcquire::https::Timeout "600";\nAcquire::Retries "5";\nAcquire::http::Pipeline-Depth "0";\n' > /etc/apt/apt.conf.d/99-build-tuning

# 安装运行时依赖
# postgresql-client-15 提供 pg_dump / psql / pg_restore：数据备份与数据迁转都依赖它们。
# 必须固定 15 版以匹配服务端 postgres:15-alpine——Debian 13 默认仓库只提供 PG17，
# 而 pg_restore 17 在初始化时无条件执行 'SET transaction_timeout = 0'（PG17+ 参数），
# PG15 服务端不识别该参数，恢复会直接失败。PGDG 仓库提供所有受支持的 PG 版本。
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg lsb-release \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq5 \
        postgresql-client-15 \
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
HEALTHCHECK --interval=30s --timeout=20s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# 启动命令：建表与幂等增量迁移（见 app/startup_migrate.py）+ uvicorn 启动
CMD ["sh", "-c", "cd /app && PYTHONPATH=/app python app/startup_migrate.py && PYTHONPATH=/app uvicorn app.main:app --host 0.0.0.0 --port 8000"]
