import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Popover, Typography } from 'antd';
import type { StatusIssue } from '../hooks/useStatusProbes';
import styles from './StatusIndicator.module.css';

const { Text } = Typography;

/** 轮播切换间隔 */
const ROTATE_MS = 2000;

export type StatusIndicatorLayout = 'inline' | 'floating';

interface StatusIndicatorProps {
  /** 当前异常列表；为空时整个指示器不渲染 */
  issues: StatusIssue[];
  /** inline：header 内嵌；floating：登录/锁定页右下角浮层 */
  layout: StatusIndicatorLayout;
}

/** 合并 CSS Modules 类名；过滤 undefined（noUncheckedIndexedAccess 下 styles.x 可能为 undefined） */
function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
}

/** 读取系统「减少动态效果」偏好，动态变化时同步 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

function Panel({ issues }: { issues: StatusIssue[] }) {
  return (
    <div className={cx(styles.panel)}>
      {issues.map((it) => (
        <div key={it.id} className={cx(styles.panelItem)}>
          <span
            className={cx(styles.dot, it.level === 'critical' ? styles.critical : styles.warning)}
            aria-hidden
          />
          <Text type="secondary">{it.text}</Text>
        </div>
      ))}
    </div>
  );
}

/**
 * 状态指示器：状态灯 + 状态信息。
 *
 * - 无异常时返回 null（不渲染任何占位）
 * - 多条异常时文字轮播（每条 ROTATE_MS），灯色取整体最严重等级保持稳定不闪
 * - 悬停暂停轮播并弹出完整异常列表
 * - 系统偏好减少动态效果时停止轮播，固定显示最严重一条
 */
export default function StatusIndicator({ issues, layout }: StatusIndicatorProps) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  // 严重项排前，同级别保持探测顺序
  const sorted = useMemo(() => {
    const rank: Record<StatusIssue['level'], number> = { critical: 0, warning: 1 };
    return [...issues].sort((a, b) => rank[a.level] - rank[b.level]);
  }, [issues]);

  // 只在异常集合「内容」变化时回到第一条。
  // 探测周期会给同内容的列表换新引用，若依赖 sorted 就会每个周期重置索引、
  // 文字跳回第一条，看起来像闪。
  const signature = useMemo(() => sorted.map((i) => i.id).join('|'), [sorted]);

  useEffect(() => {
    setIndex(0);
  }, [signature]);

  useEffect(() => {
    if (sorted.length <= 1 || reduced || hovered) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % sorted.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [sorted, reduced, hovered]);

  if (sorted.length === 0) return null;

  const current = sorted[Math.min(index, sorted.length - 1)] ?? sorted[0];
  if (!current) return null;

  const worst = sorted.some((i) => i.level === 'critical') ? 'critical' : 'warning';
  const dotClass = worst === 'critical' ? styles.critical : styles.warning;
  const rotating = !reduced && sorted.length > 1;

  // 开合状态只由 Popover 自己管（trigger="hover"）：它在弹出层上也挂了 mouseenter，
  // 鼠标从触发文字移到列表时会取消收起计时器。若在此 span 上再挂 onMouseLeave 立即
  // setHovered(false)，就会抢先一步把 Popover 关掉，表现为「刚移到列表上就消失」。
  // hovered 仅用于暂停轮播，由 onOpenChange 同步即可。
  const body = (
    <span
      className={cx(styles.wrap, layout === 'floating' ? styles.floating : styles.inline)}
      role="status"
      aria-live="polite"
    >
      <span className={cx(styles.dot, dotClass)} aria-hidden />
      <Text key={current.id} type="secondary" className={cx(styles.text, rotating && styles.swap)}>
        {current.text}
      </Text>
    </span>
  );

  /**
   * inline 模式套一个零宽占位容器承载绝对定位，使指示器脱离 flex 流——
   * 出现/消失都不会挤压模块标题与右侧按钮组；floating 模式直接返回。
   */
  const place = (node: ReactNode) =>
    layout === 'floating' ? node : <span className={styles.anchor}>{node}</span>;

  // 一条或多条都套 Popover。原来单条时提前返回不带 Popover，
  // 导致只有一条异常时鼠标悬停毫无反应。
  return place(
    <Popover
      content={<Panel issues={sorted} />}
      title="当前状态提示"
      placement="bottomRight"
      open={hovered}
      onOpenChange={setHovered}
      trigger="hover"
      // 留出从触发文字移到弹出列表的缓冲时间。默认 0.1s 偏紧，
      // 列表弹在下方时鼠标要跨越一段空隙，容易被判为离开而立即收起。
      mouseLeaveDelay={0.3}
    >
      {body}
    </Popover>,
  );
}
