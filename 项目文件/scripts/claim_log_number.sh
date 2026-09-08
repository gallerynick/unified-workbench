#!/usr/bin/env bash
# claim_log_number.sh — 开发日志序号原子占位
#
# 用法:  sh claim_log_number.sh [日志目录]
# 输出:  独占的 3 位序号，如 088
# 释放:  rmdir <日志目录>/.locks/088
#
# 原理: mkdir 在 POSIX 上对同名路径是原子操作，多个会话同时抢占时
#       恰好只有一个成功，无需任何会话间通信。
#       遗留锁用目录 mtime 判定（而非 claimed_at 内容），避免
#       "目录已建、claimed_at 未写"窗口期被误判为遗留锁而抢占新锁。

set -eu

LOG_DIR=项目开发日志
if [ $# -ge 1 ]; then
  LOG_DIR=$1
fi
LOCK_DIR="$LOG_DIR/.locks"
STALE_MIN=1440      # 遗留锁默认 24h 后回收

mkdir -p "$LOCK_DIR"

# 1) 扫描当前最大序号（锚定 日志编号_YYYYMMDD_NNN_ 格式）
max=0
for f in "$LOG_DIR"/*.md; do
  [ -e "$f" ] || continue
  n=$(basename "$f" | sed -nE 's/.*_(20[0-9]{6})_([0-9]{3})_.*/\2/p' | head -1)
  if [ -n "$n" ] && [ "$n" -gt "$max" ]; then
    max=$n
  fi
done

# 2) 从 max+1 起逐个原子占位
#    10# 强制十进制，避免 087 这类前导零被当八进制解析
n=$((10#$max + 1))
while :; do
  dir="$LOCK_DIR/$(printf '%03d' "$n")"
  if mkdir "$dir" 2>/dev/null; then
    date +%s > "$dir/claimed_at"
    printf '%03d\n' "$n"
    exit 0
  fi
  # mkdir 失败 → 锁已被其他会话持有；仅当锁超过 STALE_MIN 分钟才回收
  if find "$dir" -maxdepth 0 -mmin +"$STALE_MIN" -print -quit 2>/dev/null | grep -q .; then
    if mv "$dir" "$dir.stale.$(date +%s)-$$" 2>/dev/null; then
      continue      # 抢到回收权，重试同一序号
    fi
  fi
  n=$((10#$n + 1))
  if [ "$n" -gt 999 ]; then
    echo "错误：序号空间耗尽（>999）" >&2
    exit 1
  fi
done
