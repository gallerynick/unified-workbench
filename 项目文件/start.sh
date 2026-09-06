#!/bin/bash
# 一站式工作台 - 一键启动脚本（macOS / Linux）
# 自动检测本机局域网 IP，一步启动所有服务
set -e

cd "$(dirname "$0")"

# 自动探测 docker（跨 Docker Desktop / OrbStack / 标准安装，见 scripts/docker-detect.sh）
source "$(dirname "$0")/scripts/docker-detect.sh"
if ! ensure_docker; then
    echo "请安装并启动 Docker Desktop / OrbStack / Docker Engine 后重试。"
    exit 1
fi
if ! ensure_docker_compose; then
    exit 1
fi
if ! dw info > /dev/null 2>&1; then
    echo "[错误] docker 已安装但 daemon 未运行！"
    echo "请先启动 Docker Desktop（或 Docker Engine），然后重试。"
    exit 1
fi

# 检测本机局域网 IP（用于 WebRTC ICE + 启动后的地址提示）
if [[ "$OSTYPE" == "darwin"* ]]; then
  LAN_IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
else
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
LAN_IP="${LAN_IP:-未检测到}"
echo "本机 IP: $LAN_IP"

# Docker 使用的 HOST_IP（ICE 多候选项）
export HOST_IP="${LAN_IP},host.docker.internal"

# 确保 .env 存在
if [ ! -f .env ]; then
  cp .env.example .env
  echo "已从 .env.example 创建 .env"
fi

echo "正在启动所有服务..."
dw_compose -p unified-workbench up -d --build

echo ""
echo "========== 全部服务已启动 =========="
echo "  本机 HTTP:  http://localhost"
echo "  本机 HTTPS: https://localhost"
echo "  局域网 HTTP:  http://${LAN_IP}"
echo "  局域网 HTTPS: https://${LAN_IP}"
echo "====================================="
