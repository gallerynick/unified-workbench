import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getRouteTitle } from '@/config/routeTitles';
import { isDebugModeEnabled } from '@/pages/settings/SiteSettings';
import styles from './DebugModeOverlay.module.css';

/** 读取元素的"模块代号"：优先 data-menu-id，其次 data-tab-key，再次已有 title，最后取文本 */
function resolveModuleCode(el: HTMLElement): string {
  return (
    el.getAttribute('data-menu-id') ??
    el.getAttribute('data-tab-key') ??
    el.getAttribute('title') ??
    el.textContent ??
    ''
  ).trim();
}

/** 为所有菜单项与 Tab 注入 title 属性，帮助识别模块代号 */
function annotateDom(): void {
  document.querySelectorAll<HTMLElement>('.ant-menu-item').forEach((el) => {
    const code = resolveModuleCode(el);
    if (code && el.getAttribute('title') !== code) {
      el.setAttribute('title', code);
    }
  });
  document.querySelectorAll<HTMLElement>('.ant-tabs-tab').forEach((el) => {
    const code = resolveModuleCode(el);
    if (code && el.getAttribute('title') !== code) {
      el.setAttribute('title', code);
    }
  });
}

/** 获取当前侧边栏选中的菜单项 key */
function getSelectedMenuKey(): string {
  const selected = document.querySelector<HTMLElement>('.ant-menu-item-selected');
  if (!selected) return '-';
  return resolveModuleCode(selected) || '-';
}

export default function DebugModeOverlay() {
  const location = useLocation();
  const [menuKey, setMenuKey] = useState<string>(getSelectedMenuKey);

  useEffect(() => {
    if (!isDebugModeEnabled()) return;

    annotateDom();
    setMenuKey(getSelectedMenuKey());

    // 持续追踪 DOM 变化：菜单切换 / Tab 切换时更新 title 与选中项
    const observer = new MutationObserver(() => {
      annotateDom();
      setMenuKey(getSelectedMenuKey());
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'title', 'data-menu-id'],
    });
    return () => observer.disconnect();
  }, []);

  if (!isDebugModeEnabled()) return null;

  const debugInfo = {
    pathname: location.pathname,
    routeTitle: getRouteTitle(location.pathname),
    menuKey,
  };

  return (
    <div className={styles.container ?? ''} title="调试信息面板">
      <pre className={styles.pre ?? ''}>{JSON.stringify(debugInfo, null, 2)}</pre>
    </div>
  );
}
