#!/bin/bash
# ============================================================
# 一站式工作台 - docker 自动探测库（macOS / Linux）
# ------------------------------------------------------------
# 供 start.sh / stop.sh / reset.sh source 使用。
# 作用：在任何机器上自动找到【可用】的 docker（跨 Docker Desktop /
#       OrbStack / Homebrew / 系统标准安装），并正确处理死符号链接
#       （例如指向未安装 OrbStack 的 /usr/local/bin/docker）。
#
# 用法：
#   source "$(dirname "$0")/scripts/docker-detect.sh"
#   ensure_docker              # 探测 docker 二进制，失败则报错并退出
#   ensure_docker_compose      # 探测 docker compose，失败则报错并退出
#   # 之后可用：
#   dw <args>                  # 等价于 docker <args>
#   dw_compose <args>          # 等价于 docker compose <args>（含 docker-compose 兜底）
# ============================================================

DOCKER_BIN=""
DOCKER_COMPOSE_BIN=""

# 判断某路径是否是一个【可执行且非死链】的 docker 二进制
# 用 version 探测（不需要 daemon 在运行）
_docker_binary_ok() {
  local bin="$1"
  [ -n "$bin" ] || return 1
  [ -x "$bin" ] || return 1
  # 死符号链接：指向的目标不存在
  if [ -L "$bin" ] && [ ! -e "$bin" ]; then
    return 1
  fi
  "$bin" version >/dev/null 2>&1
}

# 常见安装位置候选（按平台）
_docker_candidates() {
  case "$(uname -s)" in
    Darwin)
      # Docker Desktop / OrbStack / Homebrew(x86/arm) / 历史遗留路径
      echo "
        /Applications/Docker.app/Contents/Resources/bin/docker
        /Applications/OrbStack.app/Contents/MacOS/xbin/docker
        /Applications/OrbStack.app/Contents/Resources/bin/docker
        /opt/homebrew/bin/docker
        /usr/local/bin/docker
      "
      ;;
    Linux)
      echo "
        /usr/bin/docker
        /usr/local/bin/docker
        /snap/bin/docker
      "
      ;;
    *)
      echo "/usr/bin/docker"
      ;;
  esac
}

# 探测并设置 DOCKER_BIN；返回 0=找到，1=未找到
find_docker() {
  local cmd
  cmd="$(command -v docker 2>/dev/null || true)"
  if _docker_binary_ok "$cmd"; then
    DOCKER_BIN="$cmd"
    return 0
  fi
  local c
  for c in $(_docker_candidates); do
    if _docker_binary_ok "$c"; then
      DOCKER_BIN="$c"
      return 0
    fi
  done
  return 1
}

# 确保 docker 可用；失败给出指引
ensure_docker() {
  if find_docker; then
    echo "✔ 使用 docker: $DOCKER_BIN"
    return 0
  fi
  echo "[错误] 未找到可用的 docker 命令。" >&2
  echo "请安装并启动以下任一 Docker 环境后重试：" >&2
  echo "  • Docker Desktop（macOS / Windows / Linux）" >&2
  echo "  • OrbStack（macOS）" >&2
  echo "  • Docker Engine + Docker Compose 插件（Linux）" >&2
  return 1
}

# 确保 docker compose 可用（插件优先，独立 docker-compose 兜底）
ensure_docker_compose() {
  if "$DOCKER_BIN" compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_BIN=""
    return 0
  fi
  local dc
  dc="$(command -v docker-compose 2>/dev/null || true)"
  if [ -n "$dc" ] && [ -x "$dc" ] && "$dc" version >/dev/null 2>&1; then
    DOCKER_COMPOSE_BIN="$dc"
    return 0
  fi
  echo "[错误] docker compose 插件不可用（也未找到 docker-compose）。" >&2
  echo "请安装 Docker Desktop，或安装 docker-compose-plugin 后重试。" >&2
  return 1
}

# 运行 docker（任意子命令）
dw() { "$DOCKER_BIN" "$@"; }

# 运行 docker compose（自动处理插件 / 独立 docker-compose）
dw_compose() {
  if [ -n "$DOCKER_COMPOSE_BIN" ]; then
    "$DOCKER_COMPOSE_BIN" "$@"
  else
    "$DOCKER_BIN" compose "$@"
  fi
}
