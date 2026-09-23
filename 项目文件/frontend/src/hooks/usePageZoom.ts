import { useEffect, useState } from 'react';
import { getUserPreferences } from '../api/user-preferences';

/**
 * 页面缩放 Hook
 *
 * 在 document.documentElement 上应用 CSS `zoom`，使缩放行为与浏览器原生缩放一致：
 * - 布局时缩放，offsetWidth / clientWidth / getBoundingClientRect 均返回缩放后的值，
 *   单位统一，不再出现 transform: scale 下"视觉尺寸被当作布局尺寸"的混用问题
 * - 所有 portal 浮窗（Modal / Drawer / Popover / Dropdown / message / notification）
 *   自动跟随缩放，无需逐个改 getContainer
 * - 不创建新的包含块，position: fixed 不受影响
 *
 * 作用范围：仅调用此 Hook 的组件所在路由（工作台 + 锁定页）。
 * 通过引用计数管理，多组件同时挂载时不会互相清除。
 *
 * 路由切换防闪烁：上一个组件卸载时延迟一个 tick 清空 zoom，
 * 若新组件在此窗口内挂载则取消清理（工作台 <-> 锁定页切换不闪）。
 */

let activeCount = 0;
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

function applyZoom(scale: number): void {
  const el = document.documentElement;
  el.style.zoom = String(scale);
  // 下发 CSS 变量，供使用 100vh 的页面（如锁定页）补偿缩放
  el.style.setProperty('--zoom-scale', String(scale));
}

function clearZoom(): void {
  const el = document.documentElement;
  el.style.zoom = '';
  el.style.removeProperty('--zoom-scale');
}

export function usePageZoom(): number {
  const [zoomScale, setZoomScale] = useState(1);

  useEffect(() => {
    // 取消上一个组件卸载时设置的延迟清理
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }
    activeCount++;

    let cancelled = false;

    // 读取用户偏好并应用
    getUserPreferences()
      .then((res) => {
        if (cancelled) return;
        const zoom = res.code === 0 && res.data?.page_zoom ? res.data.page_zoom : '100';
        const scale = Number(zoom) / 100;
        setZoomScale(scale);
        applyZoom(scale);
      })
      .catch(() => {
        /* 未登录或网络错误，保持 100% */
      });

    // 监听个性化页面保存设置时派发的事件
    const onZoomChanged = (e: CustomEvent<string>) => {
      if (activeCount <= 0) return;
      const scale = Number(e.detail) / 100;
      setZoomScale(scale);
      applyZoom(scale);
    };
    window.addEventListener('zoom-changed', onZoomChanged as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener('zoom-changed', onZoomChanged as EventListener);
      activeCount--;
      if (activeCount <= 0) {
        activeCount = 0;
        // 延迟清空：给新路由组件挂载留时间取消清理
        cleanupTimer = setTimeout(() => {
          clearZoom();
        }, 0);
      }
    };
  }, []);

  return zoomScale;
}