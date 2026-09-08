import { Tooltip } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { CALENDAR_COLORS, countByColor } from './CalendarColors';
import styles from './ColorFilterBar.module.css';

export interface ColorFilterBarProps {
  /** 当前视图内的全部事件（未过滤），用于计算计数 */
  events: Array<{ color: string | null | undefined }>;
  /** 已选中的颜色值列表；空数组表示「全部」 */
  activeColors: string[];
  /** 切换某颜色的选中状态 */
  onToggleColor: (value: string) => void;
  /** 全部选中 */
  onShowAll: () => void;
}

/**
 * 日程日历 — 颜色筛选条
 *
 * 一行呈现「全部」+ 8 个颜色芯片，点击切换该颜色的显隐，
 * 并显示当前视图范围内每种颜色的事件数。
 *
 * 自洽组件：颜色常量、计数与持久化键均由 CalendarColors.ts 提供，
 * 页面只负责持有 activeColors 状态并据此过滤事件。
 *
 * Phase 2 升级为分类筛选时，芯片的取值来源由颜色改为分类，
 * 组件结构与样式可整体复用。
 */
export default function ColorFilterBar({
  events,
  activeColors,
  onToggleColor,
  onShowAll,
}: ColorFilterBarProps) {
  const total = events.length;
  const counts = countByColor(events.map((e) => e.color));
  const noneCount = counts.get('none') ?? 0;
  const allSelected = activeColors.length === 0;
  const shownCount = allSelected
    ? total
    : activeColors.reduce((sum, c) => sum + (counts.get(c) ?? 0), 0);

  const chipClass = (active: boolean) =>
    [styles.chip, active ? styles.chipActive : ''].filter(Boolean).join(' ');

  const summaryText = allSelected ? '显示全部' : ['显示 ', shownCount, ' / ', total].join('');

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={chipClass(allSelected)}
        onClick={onShowAll}
        aria-pressed={allSelected}
      >
        <FilterOutlined className={styles.icon} />
        <span className={styles.chipLabel}>全部</span>
        <span className={styles.chipCount}>{total}</span>
      </button>

      <span className={styles.divider} aria-hidden />

      {CALENDAR_COLORS.map((c) => {
        const active = activeColors.includes(c.value);
        const count = counts.get(c.value) ?? 0;
        return (
          <button
            key={c.value}
            type="button"
            className={chipClass(active)}
            onClick={() => onToggleColor(c.value)}
            aria-pressed={active}
          >
            <Tooltip title={c.name} placement="top" mouseEnterDelay={0.3}>
              <span className={styles.dot} style={{ backgroundColor: c.value }} aria-hidden />
            </Tooltip>
            <span className={styles.chipLabel}>{c.name}</span>
            <span className={styles.chipCount}>{count}</span>
          </button>
        );
      })}

      {noneCount > 0 && (
        <Tooltip title="未设置颜色的事件" placement="top" mouseEnterDelay={0.3}>
          <span className={styles.noneHint}>
            <span
              className={styles.dot}
              style={{ backgroundColor: 'var(--text-tertiary)' }}
              aria-hidden
            />
            未着色 {noneCount}
          </span>
        </Tooltip>
      )}

      <span className={styles.spacer} />
      <span className={styles.summary}>{summaryText}</span>
    </div>
  );
}
