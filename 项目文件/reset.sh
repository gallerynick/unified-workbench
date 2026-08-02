#!/bin/bash
# 一站式工作台 - 彻底重置脚本（macOS / Linux）
# 删除所有容器、数据卷、文件，回到未初始化状态
set -e

cd "$(dirname "$0")"

# ============================================================
# 0. 警告与确认
# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║          ⚠️   彻 底 重 置 警 告   ⚠️           ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  此操作将永久删除以下内容：                      ║"
echo "║  • 所有数据库数据（用户/内容/文件记录等）        ║"
echo "║  • 所有上传文件                                  ║"
echo "║  • 所有备份数据                                  ║"
echo "║  • Redis 缓存与队列数据                          ║"
echo "║  • 所有 Docker 容器（含 Mediamtx）               ║"
echo "║                                                  ║"
echo "║  ⛔ 此操作不可撤销！                             ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
read -p "输入 YES 确认重置（其他任意键取消）: " confirm

if [ "$confirm" != "YES" ]; then
    echo "已取消。"
    exit 0
fi

echo ""
echo "开始重置..."

# ============================================================
# 1. 停止并删除所有工作台容器（含 Mediamtx）
# ============================================================
echo "→ 停止所有容器..."
docker compose -p unified-workbench down --remove-orphans 2>/dev/null || true

# Mediamtx 可能不在此 compose 中，单独处理
MEDIA_CONTAINER=$(docker ps -a --filter "name=mediamtx" --format "{{.ID}}" 2>/dev/null || true)
if [ -n "$MEDIA_CONTAINER" ]; then
    echo "→ 停止 Mediamtx 容器..."
    docker stop "$MEDIA_CONTAINER" 2>/dev/null || true
    docker rm "$MEDIA_CONTAINER" 2>/dev/null || true
fi

# ============================================================
# 2. 删除 Docker 数据卷
# ============================================================
echo "→ 删除数据库卷..."
docker volume rm unified-workbench_pg_data 2>/dev/null || true

echo "→ 删除 Redis 卷..."
docker volume rm unified-workbench_redis_data 2>/dev/null || true

# 删除孤立卷（名称前缀匹配 unified-workbench）
echo "→ 清理遗留卷..."
docker volume ls --filter "name=unified-workbench" -q 2>/dev/null | xargs -r docker volume rm 2>/dev/null || true

# ============================================================
# 3. 删除持久化文件数据
# ============================================================
echo "→ 删除上传文件..."
rm -rf data/files/* 2>/dev/null || true

echo "→ 删除备份文件..."
rm -rf data/backups/* 2>/dev/null || true

# ============================================================
# 4. 完成后提示
# ============================================================
echo ""
echo "==========================================="
echo "   系统已彻底重置，回到未初始化状态。"
echo "   使用 ./start.sh 重新初始化启动。"
echo "==========================================="
echo ""
