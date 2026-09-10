#!/bin/bash
# ============================================================
# 一站式工作台 - 一键启动脚本（macOS / Linux）
# ------------------------------------------------------------
# 流程：
#   [1/5] 环境检查   docker / docker compose / daemon
#   [2/5] 前端构建   dist 缺失或过期时自动 npm run build
#   [3/5] 启动服务   docker compose up -d --build
#   [4/5] 健康检查   等待容器就绪，异常服务打印尾部日志
#   [5/5] 汇总       访问地址 / 入口校验 / 服务状态 / 耗时
#
# 为什么前端必须本地构建：
#   frontend/Dockerfile 直接 COPY dist（容器内不跑 npm，规避构建期
#   网络不可达）。若 dist 过期，docker compose --build 会命中缓存并
#   静默复用旧产物，表现为「全部服务已启动」但改动并未生效。
#   故本脚本在启动前比对源码与 dist 的修改时间，按需构建；启动后再
#   等容器健康、校验入口可访问，避免假阳性成功。
# ============================================================
set -e

cd "$(dirname "$0")"

PROJECT_NAME="unified-workbench"
FRONTEND_DIR="frontend"
DIST_DIR="frontend/dist"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
START_EPOCH=$(date +%s)

SKIP_BUILD="${SKIP_FRONTEND_BUILD:-0}"
FORCE_BUILD="${FORCE_FRONTEND_BUILD:-0}"

# ── 输出辅助 ────────────────────────────────────────────────
hr()   { echo "──────────────────────────────────────────────────"; }
step() { hr; echo "▶ [$1/5] $2"; hr; }
info() { echo "  · $*"; }
ok()   { echo "  ✔ $*"; }
warn() { echo "  ⚠ $*" >&2; }
fail() { echo "  ✘ $*" >&2; exit 1; }

# ── 参数解析 ────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --skip-build)       SKIP_BUILD=1 ;;
    --rebuild-frontend) FORCE_BUILD=1 ;;
    --help|-h)
      cat <<'USAGE'
用法: ./start.sh [选项]

选项:
  --skip-build         跳过前端构建（仅当 frontend/dist 已知为最新时使用）
  --rebuild-frontend   强制重建前端，忽略 dist 新鲜度判断

环境变量:
  SKIP_FRONTEND_BUILD=1    等价于 --skip-build
  FORCE_FRONTEND_BUILD=1   等价于 --rebuild-frontend
  HEALTH_TIMEOUT=120       等待容器健康的超时秒数

说明:
  本脚本自动判断前端产物 frontend/dist 是否过期（比较源码与产物的
  修改时间），过期或缺失时先执行 npm run build，再 docker compose
  --build。启动后等待容器健康并校验入口可访问，避免「镜像未更新但
  显示成功」的假阳性。
USAGE
      exit 0 ;;
    *) echo "[错误] 未知参数: $arg（--help 查看用法）"; exit 1 ;;
  esac
done

# ============================================================
# [1/5] 环境检查
# ============================================================
step 1 "环境检查"

source "$(dirname "$0")/scripts/docker-detect.sh"
ensure_docker
ensure_docker_compose
dw info >/dev/null 2>&1 || fail "docker daemon 未运行，请先启动 Docker Desktop / Docker Engine"
ok "docker / docker compose 可用"

# 检测本机局域网 IP（用于 WebRTC ICE + 启动后的地址提示）
if [ "$(uname -s)" = "Darwin" ]; then
  LAN_IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1) || true
else
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || true
fi
LAN_IP="${LAN_IP:-未检测到}"
export HOST_IP="$LAN_IP,host.docker.internal"
info "本机 IP: $LAN_IP（HOST_IP=$HOST_IP）"

# 确保 .env 存在
if [ ! -f .env ]; then
  cp .env.example .env
  info "已从 .env.example 创建 .env"
fi

# ============================================================
# [2/5] 前端构建
# ============================================================

# 兼容 macOS(BSD stat) / Linux(GNU stat)：输出修改时间 epoch 秒
stat_epoch() {
  if [ "$(uname -s)" = "Darwin" ]; then
    stat -f '%m' "$@"
  else
    stat -c '%Y' "$@"
  fi
}

# 取给定路径下所有文件的最新修改时间；无文件时输出 0
newest_epoch() {
  local max=0 t f
  while IFS= read -r f; do
    t=$(stat_epoch "$f" 2>/dev/null) || continue
    if [ "$t" -gt "$max" ]; then max="$t"; fi
  done < <(find "$@" -type f 2>/dev/null)
  echo "$max"
}

build_frontend() {
  step 2 "前端构建（$DIST_DIR）"

  if [ "$SKIP_BUILD" = "1" ]; then
    [ -f "$DIST_DIR/index.html" ] || fail "frontend/dist 不存在，无法跳过前端构建"
    warn "已按 --skip-build 跳过前端构建，沿用现有产物"
    return 0
  fi

  command -v node >/dev/null 2>&1 || {
    if [ -f "$DIST_DIR/index.html" ]; then
      warn "未找到 node，沿用现有 frontend/dist（若源码已改动，本次部署不会包含）"
      return 0
    fi
    fail "未找到 node/npm 且 frontend/dist 不存在，无法构建前端"
  }
  command -v npm >/dev/null 2>&1 || fail "未找到 npm，无法构建前端"

  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    info "node_modules 缺失，执行 npm install ..."
    ( cd "$FRONTEND_DIR" && npm install ) || fail "npm install 失败"
    ok "依赖安装完成"
  fi

  local src_latest dist_latest reason
  src_latest=$(newest_epoch "$FRONTEND_DIR/src" "$FRONTEND_DIR/vite.config.ts" "$FRONTEND_DIR/tsconfig.json" "$FRONTEND_DIR/package.json")
  if [ -d "$DIST_DIR" ]; then
    dist_latest=$(newest_epoch "$DIST_DIR")
  else
    dist_latest=0
  fi

  if [ "$FORCE_BUILD" = "1" ]; then
    reason="强制重建（--rebuild-frontend）"
  elif [ "$dist_latest" = "0" ]; then
    reason="dist 不存在"
  elif [ "$src_latest" -gt "$dist_latest" ]; then
    reason="源码比 dist 新（产物已过期）"
  fi

  if [ -z "$reason" ]; then
    ok "dist 为最新，跳过构建"
    return 0
  fi

  info "触发构建：$reason"
  local t0 t1
  t0=$(date +%s)
  ( cd "$FRONTEND_DIR" && npm run build ) || fail "前端构建失败（tsc / vite）"
  t1=$(date +%s)
  ok "前端构建完成（耗时 $((t1 - t0))s）"
}

build_frontend

# ============================================================
# [3/5] 启动服务
# ============================================================
step 3 "启动服务（docker compose up -d --build）"
dw_compose -p "$PROJECT_NAME" up -d --build

# ============================================================
# [4/5] 健康检查
# ============================================================
wait_healthy() {
  step 4 "等待容器健康（超时 ${HEALTH_TIMEOUT}s）"
  local deadline snap bad n svc status
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))

  while :; do
    snap=$(dw_compose -p "$PROJECT_NAME" ps --format '{{.Service}}|{{.Status}}' 2>/dev/null) || true
    bad=$(printf '%s\n' "$snap" | awk -F'|' '
      $2 ~ /unhealthy/ || $2 ~ /Restarting/ || $2 ~ /^Exited/ || $2 ~ /health: starting/ {
        print $1 "|" $2
      }')
    n=$(printf '%s\n' "$snap" | grep -c .) || true
    if [ -z "$bad" ] && [ "$n" -gt 0 ]; then
      break
    fi
    if [ "$(date +%s)" -ge "$deadline" ]; then
      break
    fi
    sleep 3
  done

  if [ -n "$bad" ]; then
    warn "以下服务未就绪："
    while IFS='|' read -r svc status; do
      [ -z "$svc" ] && continue
      echo "    - $svc: $status"
    done <<< "$bad"
    echo ""
    warn "最近日志（尾部 60 行）："
    dw_compose -p "$PROJECT_NAME" logs --tail=25 --no-color 2>&1 | tail -60 | sed 's/^/    /'
    fail "服务未通过健康检查（可稍后重试 ./start.sh）"
  fi

  ok "所有容器已就绪"
}

wait_healthy

# ============================================================
# [5/5] 汇总
# ============================================================
print_summary() {
  step 5 "汇总"
  local el code_fe code_api
  el=$(( $(date +%s) - START_EPOCH ))

  echo ""
  echo "  本机   HTTP:  http://localhost"
  echo "  本机   HTTPS: https://localhost"
  echo "  局域网 HTTP:  http://$LAN_IP"
  echo "  局域网 HTTPS: https://$LAN_IP"
  echo "  API 文档:    https://localhost/api/v1/docs"
  echo ""

  if command -v curl >/dev/null 2>&1; then
    code_fe=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 https://localhost/) || echo 000
    code_api=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 https://localhost/api/v1/health) || echo 000
    if [ "$code_fe" = "200" ] && [ "$code_api" = "200" ]; then
      ok "入口校验通过（前端 200 / 后端 /api/v1/health 200）"
    else
      warn "入口校验未全绿：前端=$code_fe 后端health=$code_api（服务可能仍在初始化）"
    fi
  else
    info "未找到 curl，跳过入口校验"
  fi

  echo ""
  dw_compose -p "$PROJECT_NAME" ps 2>/dev/null | sed 's/^/    /'
  echo ""
  echo "  总耗时: ${el}s      重新部署: ./start.sh      停止: ./stop.sh"
  echo ""
}

print_summary
