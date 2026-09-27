import { useMemo } from 'react';
import { theme } from 'antd';
import { useTheme } from '../contexts/ThemeContext';

/**
 * 解析 CSS 变量为具体颜色值。
 *
 * recharts 把 fill / stroke 输出为 SVG presentation attribute（而非 CSS 属性），
 * attribute 无法解析 var(...)；canvas 同理。故图表颜色必须在运行时解析为具体值。
 * 参考 notes/GraphView.tsx 的同名做法。
 */
export function resolveCssVar(cssVar: string): string {
  const m = /^var\((--[^)]+)\)$/.exec(cssVar);
  if (!m?.[1]) return cssVar;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || cssVar;
}

/** 资源监视页图表用到的全部颜色（均为已解析的具体值）。 */
export interface MonitorChartColors {
  /** CPU 环形图五段 */
  user: string;
  system: string;
  iowait: string;
  steal: string;
  idle: string;
  /** 压力等级：正常 / 偏高 / 紧张 / 过载，同时复用于每核心占用条 */
  levelNormal: string;
  levelElevated: string;
  levelHigh: string;
  levelCritical: string;
  /** 每核心占用条三档色：正常 / 偏高 / 过载 */
  coreLow: string;
  coreMid: string;
  coreHigh: string;
  /** 内存堆叠面积 */
  memoryUsed: string;
  memoryCached: string;
  memoryBuffers: string;
  memoryFree: string;
  /** 负载曲线 */
  load1: string;
  load5: string;
  load15: string;
  /** 磁盘与网络 */
  diskRead: string;
  diskWrite: string;
  netSent: string;
  netRecv: string;
  /** 坐标轴与网格 */
  axis: string;
  grid: string;
  refLine: string;
}

/** CSS 变量名映射表：只允许 token.css 中已定义的 token，不写死 hex。 */
const COLOR_SOURCES: Record<keyof MonitorChartColors, string> = {
  user: 'var(--color-info)',
  system: 'var(--color-purple)',
  iowait: 'var(--color-orange)',
  steal: 'var(--color-red)',
  idle: 'var(--bg-tertiary)',

  levelNormal: 'var(--color-success)',
  levelElevated: 'var(--color-warning)',
  levelHigh: 'var(--color-orange)',
  levelCritical: 'var(--color-error)',

  coreLow: 'var(--color-info)',
  coreMid: 'var(--color-orange)',
  coreHigh: 'var(--color-error)',

  memoryUsed: 'var(--color-purple)',
  memoryCached: 'var(--color-cyan)',
  memoryBuffers: 'var(--color-indigo)',
  memoryFree: 'var(--bg-tertiary)',

  load1: 'var(--color-orange)',
  load5: 'var(--color-info)',
  load15: 'var(--color-purple)',

  diskRead: 'var(--color-cyan)',
  diskWrite: 'var(--color-purple)',
  netSent: 'var(--color-info)',
  netRecv: 'var(--color-success)',

  axis: 'var(--text-secondary)',
  grid: 'var(--border-secondary)',
  refLine: 'var(--text-secondary)',
};

/**
 * 返回资源监视页所需的图表配色。
 *
 * 依赖 antd token 与 isDark：antd token 本身随主题重建，isDark 用于
 * 触发 CSS 变量重算（--color-orange 无暗色变体，其余语义 token 均随
 * data-theme 切换）。两者任一变化都会重算，且每次渲染只解析一次。
 */
export function useMonitorChartColors(): MonitorChartColors {
  const { isDark } = useTheme();
  const antdToken = theme.useToken().token;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- 颜色随主题切换重算
  return useMemo(() => {
    const out = Object.fromEntries(
      Object.entries(COLOR_SOURCES).map(([k, v]) => [k, resolveCssVar(v)])
    ) as MonitorChartColors;
    return {
      ...out,
      // antd token 优先：与 antd 组件同源的次级文字与边框色
      axis: antdToken.colorTextSecondary || out.axis,
      grid: antdToken.colorBorderSecondary || out.grid,
    };
  }, [isDark, antdToken]);
}
