/**
 * 任务卡片标记色调色板
 *
 * 前端与后端 app/schemas/task.py 的 VALID_COLORS 必须保持一致。
 * 颜色一律以 design token 变量名保存，渲染时通过 var() 取用，
 * 因此深浅色模式与主题切换自动适配，不落任何硬编码 hex。
 */

export interface TaskColorOption {
  /** 存入后端的取值 */
  key: string;
  /** 中文标签 */
  label: string;
  /** design token 变量名（不含 var() 包裹） */
  token: string;
}

export const TASK_COLORS: TaskColorOption[] = [
  { key: 'blue', label: '蓝', token: 'color-primary' },
  { key: 'cyan', label: '青', token: 'color-cyan' },
  { key: 'green', label: '绿', token: 'color-success' },
  { key: 'orange', label: '橙', token: 'color-orange' },
  { key: 'red', label: '红', token: 'color-red' },
  { key: 'purple', label: '紫', token: 'color-purple' },
  { key: 'pink', label: '粉', token: 'color-magenta' },
  { key: 'gray', label: '灰', token: 'text-tertiary' },
];

/** 未指定颜色时的默认标记色（存量任务） */
export const DEFAULT_TASK_COLOR = 'blue';

/** 把调色板 key 解析成可直接用于 style 的 CSS 颜色值 */
export function taskColorValue(key?: string | null): string {
  const found = TASK_COLORS.find((c) => c.key === key);
  return `var(--${found ? found.token : DEFAULT_TASK_COLOR})`;
}

/** 取中文标签，用于展示与 Tooltip */
export function taskColorLabel(key?: string | null): string {
  const found = TASK_COLORS.find((c) => c.key === key);
  return found ? found.label : taskColorLabel(DEFAULT_TASK_COLOR);
}
