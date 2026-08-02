#!/bin/bash
# 一站式工作台 - 停止脚本（macOS / Linux）
# 停止所有服务容器，保留数据和配置
set -e

cd "$(dirname "$0")"

echo ""
echo "============================================"
echo "  一站式工作台 - 停止所有服务"
echo "============================================"
echo ""

# 停止主项目容器（保留数据卷）
echo "▶ 正在停止 Unified Workbench 服务..."
docker compose -p unified-workbench down

# 停止 Mediamtx（独立容器，不在 compose 中）
echo "▶ 正在停止 Mediamtx..."
docker stop unified-workbench-mediamtx-1 2>/dev/null && \
docker rm unified-workbench-mediamtx-1 2>/dev/null || \
echo "  Mediamtx 未运行，跳过"

echo ""
echo "============================================"
echo "  所有服务已停止。"
echo ""
echo "  重新启动：./start.sh"
echo "============================================"
echo ""
