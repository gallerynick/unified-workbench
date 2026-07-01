#!/bin/bash
# 一站式工作台 - macOS 启动脚本（自动检测局域网 IP 用于 WebRTC 流媒体）
set -e

cd "$(dirname "$0")"

# 自动检测本机局域网 IP
HOST_IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
if [ -z "$HOST_IP" ]; then
  HOST_IP="host.docker.internal"
fi
# 同时包含局域网 IP 和 Docker 内部地址，保证 ICE 候选覆盖面
HOST_IP="${HOST_IP},host.docker.internal"
echo "检测到本机 IP: $HOST_IP"

# Docker Desktop 运行中？
if ! docker info > /dev/null 2>&1; then
  echo "请先启动 Docker Desktop"
  exit 1
fi

# 确保 .env 存在
if [ ! -f .env ]; then
  cp .env.example .env
  echo "已从 .env.example 创建 .env，请根据需要修改配置"
fi

# 导出 HOST_IP 供 docker-compose.yml 使用
export HOST_IP

echo "正在启动服务..."
docker compose -p unified-workbench up -d --build

echo ""
echo "全部服务已启动"
echo "本地访问: http://localhost"
echo "局域网访问: http://${HOST_IP}"
docker compose ps
