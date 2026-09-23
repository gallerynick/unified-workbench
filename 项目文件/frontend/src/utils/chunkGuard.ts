import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * 懒加载 chunk 失效自愈
 *
 * 背景：项目每次部署都会重新构建前端镜像（start.sh 走 docker compose --build），
 * Vite 产物按内容哈希命名，旧哈希的 chunk 文件在新构建中已不存在。
 * 长时间闲置的标签页内存里仍是部署前的 entry bundle，其中记录的仍是旧哈希；
 * 回来后点击一个尚未加载过的模块，React.lazy 的 import() 请求旧 chunk 得到 404，
 * 抛出 TypeError: Failed to fetch dynamically imported module，
 * 命中 React Router 内置默认错误页 "Unexpected Application Error!"，刷新后才恢复。
 *
 * 两层对策：
 * 1. 主动探测——对比线上 index.html 的 entry 哈希与本页面已加载的，发现新部署即置标记；
 *    下一次懒加载真正发生时先整页刷新（此时页面尚未崩溃，无数据丢失风险）。
 * 2. 被动兜底——import() 真的失败时自动刷新一次，并用 sessionStorage 保护窗口防止
 *    「刷新后仍失败 → 再刷新」的无限循环；窗口内再次失败则交给友好错误页承接。
 */

const RELOAD_FLAG = 'workbench_chunk_reload_at';
/** 保护窗口：该窗口内不再自动刷新 */
const RELOAD_GUARD_MS = 2 * 60 * 1000;

/** 线上 index.html 已探测到新部署，下一次懒加载前先整页刷新 */
let newBuildDetected = false;

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Unable to preload CSS|ChunkLoadError|Loading chunk [^]*failed|Loading CSS chunk [^]*failed|NetworkError when loading[^]*chunk/i;

/** 判断是否为懒加载 chunk 失效（区别于业务代码自身的异常） */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return CHUNK_ERROR_RE.test(msg);
}

/**
 * 记录一次自动刷新并整页 reload。
 * 返回 false 表示仍在保护窗口内，调用方不应再刷新，应让异常向上抛出。
 */
export function reloadForChunkFailure(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    if (last && Date.now() - last < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    // sessionStorage 不可用时不做自动刷新，避免无法退出的循环
    return false;
  }
  window.location.reload();
  return true;
}

/** 由新版本探测置位 */
export function markNewBuildDetected(): void {
  newBuildDetected = true;
}

/** 永不 resolve：让 React 保持 Suspense，等整页刷新完成 */
function neverSettles<T>(): Promise<{ default: T }> {
  return new Promise(() => {});
}

/**
 * 带 chunk 失效自愈能力的 lazy，用法与 React.lazy 完全一致。
 * router.tsx 用它替换 React.lazy 即可让全部懒加载路由获得保护。
 */
export function lazyChunk<T extends ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    if (newBuildDetected) {
      newBuildDetected = false;
      // 部署已发生过：此刻刷新比等 404 崩溃再兜底更干净
      if (reloadForChunkFailure()) return neverSettles<T>();
    }
    try {
      return await loader();
    } catch (err) {
      if (isChunkLoadError(err) && reloadForChunkFailure()) return neverSettles<T>();
      throw err;
    }
  });
}

/** 当前页面已加载的 entry 脚本 src；开发模式无哈希产物时返回空串 */
function currentEntry(): string {
  const el = document.querySelector('script[src*="/assets/index-"]');
  return el ? (el.getAttribute('src') ?? '') : '';
}

const ENTRY_SRC_RE = /src="([^"]*\/index-[A-Za-z0-9_-]+\.js)"/;

/**
 * 监听线上构建变化。
 * index.html 在 nginx 中是 no-store，因此每次探测都能拿到最新 manifest，
 * 而其内部引用的 entry 脚本名带内容哈希——哈希变了即说明前端已重新部署。
 * 探测只置标记，不主动刷新，由下一次懒加载触发。
 */
export function startBuildWatcher(intervalMs = 60 * 1000): void {
  const baseline = currentEntry();
  if (!baseline) return; // 开发模式无哈希产物，无需探测

  let busy = false;

  const check = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const res = await fetch('/index.html', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (!res.ok) return;
      const m = (await res.text()).match(ENTRY_SRC_RE);
      if (m && m[1] !== baseline) markNewBuildDetected();
    } catch {
      // 网络失败不干扰探测，等待下一次轮询
    } finally {
      busy = false;
    }
  };

  setInterval(check, intervalMs);

  // 长时间闲置后回到标签页立即检查——这正是本问题的主要触发时机
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void check();
  });
  window.addEventListener('focus', () => void check());
}
