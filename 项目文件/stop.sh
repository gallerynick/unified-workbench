#!/bin/bash
# 一站式工作台 - 停止脚本（macOS / Linux）
# 停止所有服务容器，保留数据和配置

cd "$(dirname "$0")"

# 自动探测 docker（见 scripts/docker-detect.sh）
source "$(dirname "$0")/scripts/docker-detect.sh"

echo ""
echo "============================================"
echo "  一站式工作台 - 停止所有服务"
echo "============================================"
echo ""

# 未安装 docker：无需停止
if ! find_docker; then
    echo "[信息] 未检测到 docker（可能未安装），无需停止服务。"
    exit 0
fi
echo "✔ 使用 docker: $DOCKER_BIN"

# 停止主项目容器（保留数据卷）
echo "▶ 正在停止 Unified Workbench 服务..."
if ! dw_compose -p unified-workbench down; then
    echo "[警告] compose 停止失败（daemon 未运行或项目未启动），继续执行..."
fi

# 停止 Mediamtx（独立容器，不在 compose 中）
echo "▶ 正在停止 Mediamtx..."
if dw stop unified-workbench-mediamtx-1 2>/dev/null && dw rm unified-workbench-mediamtx-1 2>/dev/null; then
    echo "  Mediamtx 已停止并移除"
else
    echo "  Mediamtx 未运行，跳过"
fi

echo ""
echo "============================================"
echo "  所有服务已停止。"
echo ""
echo "  重新启动：./start.sh"
echo "============================================"
echo ""
