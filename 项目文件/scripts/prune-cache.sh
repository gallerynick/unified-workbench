#!/bin/bash
# ============================================================
# 一站式工作台 - 构建缓存清理（手动执行，macOS / Linux）
# ------------------------------------------------------------
# 用法：
#   sh scripts/prune-cache.sh           交互确认后清理
#   sh scripts/prune-cache.sh --force   跳过确认（非交互环境必须加）
#   sh scripts/prune-cache.sh --help    显示帮助
#
# 【重要】为什么用 buildx prune -a，而不是裸 prune 或 --filter：
#   2026-10-01 在本机 buildx v0.35.0-desktop.2 上逐条实测：
#     --filter until=notaduration  → 正常报错（说明过滤器确实被解析）
#     --filter until=99999h        → 0B（匹配不到任何记录，行为正确）
#     --filter until=20h           → 0B（当时有 24-43h 的旧代，却清不掉）
#     裸 builder prune -f          → 只清「可回收」部分，且会留下删不掉的重复层
#     buildx prune -a -f           → 7.064GB ✓ 彻底清空，缓存降到 51MB
#
#   实测发现两类问题：
#   1) until 过滤器虽能解析，但匹配不到应清的历史代，做不了「保留期」
#   2) 多次改 Dockerfile 后会残留多份同内容的层（曾出现 1.11GB ×3、
#      824MB ×3），裸 prune 删不掉它们，可回收量归零而占用居高不下
#   只有 -a（连内部/前端缓存一并清除）能真正清干净。
#
# 【代价】-a 会清空全部构建缓存，下次构建是【全量重建】：
#   实测 CACHED=0、269 行下载、约 220-320s。所以请在【不急着重建】
#   的时候手动跑。清空后再构建一次，缓存会回到「单代干净」状态
#   （实测约 5.1GB，无重复层）。
#
# 【地板】缓存体积约等于镜像层体积，单代约 5.1GB：
#   COPY /usr/local 2.51GB + pip 1.11GB + torch 0.82GB + apt 0.53GB。
#   想压到更低只能减小镜像本体（剥离 __pycache__/torch 测试与头文件
#   约 353MB，或把 ASR 依赖拆成可选约 1.49GB），本脚本无法突破这个地板。
#
# 清理范围：
#   • 构建缓存   docker builder prune -f
#   • 悬空镜像   docker image prune -f
#
# 明确不做（会丢数据）：
#   • 不删卷：不加 --volumes，不跑 docker volume prune。
#     compose 卷在「docker compose down」后会变成无容器引用状态，
#     此时 volume prune -a 会把数据库卷一起删掉。
#   • 不动 frontend/dist、node_modules。
#
# 说明：本脚本【不再】被 start.sh 调用。启动流程完全不碰构建缓存。
# ============================================================
set -u

FORCE=0
for a in "$@"; do
  case "$a" in
    --force|-f) FORCE=1 ;;
    --help|-h)
      cat <<'USAGE'
用法: sh scripts/prune-cache.sh [选项]

选项:
  --force, -f   跳过交互确认（非交互环境必须加）
  --help, -h    显示本帮助

说明:
  手动清理构建缓存与悬空镜像。会清掉所有「无镜像引用」的缓存层，
  下次重建时这些步骤需重新执行。不会触碰任何卷，也不会动
  frontend/dist 与 node_modules。本脚本不被 start.sh 调用。
USAGE
      exit 0 ;;
    *) echo "[错误] 未知参数: $a（--help 查看用法）" >&2; exit 1 ;;
  esac
done

# 探测 docker（复用项目内的探测库，跨 Docker Desktop / OrbStack / Homebrew）
_self_dir="$(cd "$(dirname "$0")" && pwd)"
. "$_self_dir/docker-detect.sh"
ensure_docker || exit 1

# 取 Build Cache 行的 SIZE 列。该行 TYPE 含空格（Build Cache），故用倒数第二列，
# 避免因列位置变化取错（曾误取到 ACTIVE 计数）。
_du() { dw system df 2>/dev/null | awk '/^Build Cache/ {print $(NF-1)}'; }
_fmt() { awk -v b="$1" 'BEGIN {
    if (b >= 1073741824)    printf "%.2fGB", b / 1073741824
    else if (b >= 1048576)  printf "%.0fMB",  b / 1048576
    else if (b >= 1024)     printf "%.0fKB",  b / 1024
    else                    printf "%dB", b }'; }

echo ""
echo "  当前构建缓存：$(_du)"
echo ""

if [ "$FORCE" != "1" ]; then
  if [ -t 0 ]; then
    printf '  将清理所有可回收缓存层，下次重建需重跑这些步骤。继续？[y/N] '
    read -r _ans
    case "$_ans" in [yY]*) ;; *) echo "  已取消"; exit 0 ;; esac
  else
    echo "[错误] 非交互环境请加 --force" >&2
    exit 1
  fi
fi

# 两条命令包在 || true 里：任何异常都不能让脚本以非零码退出而掩盖结果。
out=$( { dw buildx prune -a -f 2>&1; dw image prune -f 2>&1; } || true )

# 汇总行有两种措辞，都要匹配：
#   docker 29.x buildx ： "Total:	6.257MB"
#   docker image prune ： "Total reclaimed space: 0B"
# 逐个解析成人可读容量再按字节求和，避免取到末尾那行 0B 掩盖真实释放量。
freed=$(printf '%s\n' "$out" \
  | grep -oE '(Total reclaimed space|Total):[[:space:]]*[0-9.]+[KMGTPE]?(B|B\*)?' \
  | sed 's/.*:[[:space:]]*//' \
  | awk '
      function tobytes(v, s, n) {
        sub(/\*$/, "", v); s = v; gsub(/[0-9.]/, "", s); n = v; gsub(/[^0-9.]/, "", n); n = n + 0
        if (s ~ /^[kK]B$/) return n * 1024
        if (s == "MB") return n * 1048576
        if (s == "GB") return n * 1073741824
        if (s == "TB") return n * 1099511627776
        return n
      }
      { s += tobytes($0) }
      END { printf "%.0f", s }')

echo ""
if [ "${freed:-0}" -gt 0 ]; then
  echo "  ✔ 已释放 $(_fmt "$freed")（构建层 + 悬空镜像）；当前构建缓存：$(_du)"
else
  echo "  · 无待清理的缓存（构建层 + 悬空镜像）；当前构建缓存：$(_du)"
fi
echo "  · 未触碰任何卷，未动 frontend/dist、node_modules"
echo ""
exit 0
