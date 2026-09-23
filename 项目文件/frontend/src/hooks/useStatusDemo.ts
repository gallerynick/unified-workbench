import { useEffect, useMemo, useState } from 'react';
import type { StatusIssue, StatusLevel } from './useStatusProbes';
import { isDebugModeEnabled } from '../pages/settings/SiteSettings';

/**
 * 状态指示演示模式（纯前端，不触碰后端）。
 *
 * 用法一 —— URL query（可复制地址栏直接分享给别人）：
 *   https://localhost/?status_demo=all              全部 15 条
 *   https://localhost/?status_demo=public,db        指定条目
 *   https://localhost/login?status_demo=ws,lock     登录页同样生效
 *
 * 用法二 —— DevTools Console：
 *   __statusDemo('all')           全部
 *   __statusDemo('public,db')     逗号分隔
 *   __statusDemo(['ws', 'lock'])  数组
 *   __statusDemo(null)            关闭，回到真实探测
 *
 * 开启时演示条目**覆盖**真实探测结果，保证演示内容确定、可复现；
 * 真实探测仍在后台运行，只是结果被忽略。
 * URL 是单一事实来源，Console 调用只是改写 URL，不会两套状态打架。
 *
 * **前置条件：调试模式必须开启。** 调试模式读自后端站点配置
 * （系统设置 → 站点设置 → debug_mode），全站统一。未开启时
 * URL 参数与 Console 调用都不会生效——这是有意为之，
 * 避免演示入口在交付环境里被误触。
 */

/** 可演示的状态条目：键名 → 等级 + 文案（与服务端 /system/status 语义一一对应） */
export const STATUS_DEMO_ITEMS: Record<
  string,
  { level: StatusLevel; text: string }
> = {
  backend: { level: 'critical', text: '网络已断开' },
  latency: { level: 'warning', text: '网络延迟较高' },
  insecure: { level: 'warning', text: '未启用 HTTPS' },
  unsafe: { level: 'critical', text: '非安全环境，直播等能力不可用' },
  public: { level: 'warning', text: '正在通过公网访问' },
  maintenance: { level: 'critical', text: '系统维护中' },
  db: { level: 'critical', text: '数据服务暂时不可用' },
  version: { level: 'critical', text: '版本不匹配，请刷新' },
  clock: { level: 'warning', text: '本机时间不准' },
  browser: { level: 'warning', text: '浏览器能力不完整' },
  ws: { level: 'warning', text: '实时提醒不可用' },
  storage: { level: 'critical', text: '文件服务暂时不可用' },
  stream: { level: 'warning', text: '直播服务暂时不可用' },
  tasks: { level: 'warning', text: '提醒服务暂时不可用' },
  lock: { level: 'warning', text: '即将自动锁定' },
  concurrent: { level: 'warning', text: '账号在其他设备登录' },
};

export const STATUS_DEMO_ALL: string[] = Object.keys(STATUS_DEMO_ITEMS);

const QUERY_KEY = 'status_demo';
const CHANNEL = 'status-demo-change';

function readKeys(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = new URLSearchParams(window.location.search).get(QUERY_KEY);
  if (!raw || raw === 'off') return [];
  if (raw === 'all') return STATUS_DEMO_ALL.slice();
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((k) => k in STATUS_DEMO_ITEMS);
}

function normalize(input: string | string[] | 'all' | null | undefined): string[] {
  if (input === null || input === undefined || input === 'off') return [];
  if (input === 'all') return STATUS_DEMO_ALL.slice();
  const list = typeof input === 'string' ? input.split(',') : input;
  return list.map((s) => s.trim()).filter((k) => k in STATUS_DEMO_ITEMS);
}

function writeUrl(keys: string[]): void {
  const url = new URL(window.location.href);
  if (keys.length === 0) {
    url.searchParams.delete(QUERY_KEY);
  } else {
    url.searchParams.set(QUERY_KEY, keys.join(','));
  }
  window.history.replaceState(null, '', url.toString());
  try {
    window.dispatchEvent(new Event(CHANNEL));
  } catch {
    /* 忽略 */
  }
}

/**
 * 演示模式开关。改写 URL 并广播变更。
 * 打印当前状态到控制台，便于演示时口头确认。
 */
export function setStatusDemo(
  keys: string | string[] | 'all' | null | undefined,
): string[] {
  const next = normalize(keys);
  writeUrl(next);
  // eslint-disable-next-line no-console
  console.log(
    next.length === 0
      ? '[状态指示演示] 已关闭，回到真实探测'
      : '[状态指示演示] 已开启 ' +
          next.length +
          ' 条：' +
          next.join(', ') +
          '｜URL 已更新，可复制地址栏分享',
  );
  void (async () => {
    const enabled = await isDebugModeEnabled();
    if (!enabled) {
      // eslint-disable-next-line no-console
      console.warn(
        '[状态指示演示] 调试模式未开启 → 不会显示。' +
          '请先在「系统设置 → 站点设置」打开 debug_mode 后刷新页面。',
      );
    }
  })();
  return next;
}

/**
 * 返回演示条目；返回 null 表示演示模式关闭。
 * 多个调用方（header / 登录页 / 锁定页）各自持有状态但监听同一事件，保持同步。
 */
export function useStatusDemoIssues(): StatusIssue[] | null {
  const [keys, setKeys] = useState<string[]>(() => readKeys());
  // 仅在调试模式下生效（后端站点配置，带模块级缓存）
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const value = await isDebugModeEnabled();
      if (!cancelled) setDebug(value);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onChange = () => setKeys(readKeys());
    window.addEventListener(CHANNEL, onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener(CHANNEL, onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);

  return useMemo(() => {
    if (!debug || keys.length === 0) return null;
    return keys.map<StatusIssue>((key) => {
      const item = STATUS_DEMO_ITEMS[key];
      return {
        id: 'demo-' + key,
        level: item ? item.level : 'warning',
        text: item ? item.text : key,
      };
    });
  }, [debug, keys]);
}

declare global {
  interface Window {
    /** 状态指示演示模式开关，仅用于演示；详见本文件顶部注释 */
    __statusDemo?: (
      keys: string | string[] | 'all' | null | undefined,
    ) => string[];
  }
}

// 模块加载即注册，任何页面都能从 Console 直接调用
if (typeof window !== 'undefined') {
  window.__statusDemo = setStatusDemo;
}
