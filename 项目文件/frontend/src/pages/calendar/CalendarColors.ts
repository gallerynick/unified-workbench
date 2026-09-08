/**
 * 日程日历 — 颜色注册表（单一事实来源）
 *
 * 事件颜色存储为 CSS 变量字符串（如 "var(--color-info)"），
 * 可直接参与 CSS 的 color-mix() 求值，因此无需解析为十六进制。
 *
 * Phase 2 引入命名分类体系时，本文件的色板将作为分类默认色板复用。
 */

export interface CalendarColorDef {
  /** 颜色值：CSS 变量引用字符串，可直接用于 style 与 CSS color-mix() */
  value: string;
  /** 中文名称，用于筛选条与色点 tooltip */
  name: string;
  /** CSS 变量名（不含 var() 包裹），便于拼接 color-mix() */
  token: string;
}

/** 8 个事件颜色，顺序与 UI 设计规范中的扩展强调色顺序一致 */
export const CALENDAR_COLORS: CalendarColorDef[] = [
  { value: 'var(--color-info)', token: '--color-info', name: '蓝' },
  { value: 'var(--color-success)', token: '--color-success', name: '绿' },
  { value: 'var(--color-warning)', token: '--color-warning', name: '黄' },
  { value: 'var(--color-error)', token: '--color-error', name: '红' },
  { value: 'var(--color-purple)', token: '--color-purple', name: '紫' },
  { value: 'var(--color-cyan)', token: '--color-cyan', name: '青' },
  { value: 'var(--color-magenta)', token: '--color-magenta', name: '粉' },
  { value: 'var(--color-orange-bright)', token: '--color-orange-bright', name: '橙' },
];

/** 新建事件默认颜色 */
export const DEFAULT_COLOR = CALENDAR_COLORS[0]!.value;

/** 筛选偏好存储 key（仅存视图偏好，不进后端） */
export const ACTIVE_COLORS_STORAGE_KEY = 'calendar.activeColors';

const COLOR_NAME_MAP = new Map(CALENDAR_COLORS.map((c) => [c.value, c.name]));

/** 颜色值 → 中文名称；未知值返回「其他」 */
export function colorName(value: string | null | undefined): string {
  if (!value) return '其他';
  return COLOR_NAME_MAP.get(value) ?? '其他';
}

/** 颜色值 → 对应 token 定义；未命中时回退到默认蓝色定义 */
export function colorDef(value: string | null | undefined): CalendarColorDef {
  if (!value) return CALENDAR_COLORS[0]!;
  return CALENDAR_COLORS.find((c) => c.value === value) ?? CALENDAR_COLORS[0]!;
}

/**
 * 统计事件集内各颜色的数量
 *
 * @param colors 事件颜色值数组（可为 null/undefined，按未着色归入 'none'）
 * @returns Map: 颜色值 → 数量（仅包含 count > 0 的项）
 */
export function countByColor(colors: (string | null | undefined)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of colors) {
    const key = c ?? 'none';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** 读取持久化的筛选偏好；非法值回退为「全部」 */
export function loadActiveColors(): string[] {
  try {
    const raw = localStorage.getItem(ACTIVE_COLORS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const known = new Set(CALENDAR_COLORS.map((c) => c.value));
    return parsed.filter((v): v is string => typeof v === 'string' && known.has(v));
  } catch {
    return [];
  }
}

/** 写入持久化筛选偏好 */
export function saveActiveColors(active: string[]): void {
  try {
    localStorage.setItem(ACTIVE_COLORS_STORAGE_KEY, JSON.stringify(active));
  } catch {
    // localStorage 不可用时静默降级为会话内状态
  }
}
