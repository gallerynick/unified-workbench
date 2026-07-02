#!/bin/bash
# 一站式工作台 - 一键启动脚本（macOS / Linux）
# 自动检测本机局域网 IP，一步启动所有服务
set -e

cd "$(dirname "$0")"

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

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
  echo "请先启动 Docker Desktop"
  exit 1
fi

# 确保 .env 存在
if [ ! -f .env ]; then
  cp .env.example .env
  echo "已从 .env.example 创建 .env"
fi

echo "正在启动所有服务..."
docker compose -p unified-workbench up -d --build

echo ""
echo "========== 全部服务已启动 =========="
echo "  本机 HTTP:  http://localhost"
echo "  本机 HTTPS: https://localhost"
echo "  局域网 HTTP:  http://${LAN_IP}"
echo "  局域网 HTTPS: https://${LAN_IP}"
echo "====================================="
