import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { getRouteTitle } from '@/config/routeTitles';
import { isDebugModeEnabled } from '@/pages/settings/SiteSettings';
import styles from './DebugModeOverlay.module.css';

function escapeCss(ident: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(ident);
  return ident.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function getSelectedMenuKey(): string {
  const selected = document.querySelector<HTMLElement>('.ant-menu-item-selected');
  if (!selected) return '-';
  return (
    selected.getAttribute('data-menu-id') ??
    selected.textContent ??
    '-'
  ).trim();
}

/** 计算元素在父元素【所有子节点（含文本/注释节点）】中的位置，与 CSS :nth-child() 计数基准一致 */
function nthChildIndex(el: Element): number {
  let i = 1;
  for (let s = el.previousSibling; s; s = s.previousSibling) i += 1;
  return i;
}

/** 校验选择器是否【唯一命中且指向目标元素】，比 length===1 更强，能拦截「唯一但指向错误元素」的情况 */
function matchesTarget(selector: string, el: Element): boolean {
  try {
    return document.querySelector(selector) === el;
  } catch {
    return false;
  }
}

function getUniqueSelector(el: Element): string {
  if (el === document.documentElement) return 'html';
  if (el === document.body) return 'body';

  if (el.id) {
    const idSelector = `#${escapeCss(el.id)}`;
    if (matchesTarget(idSelector, el)) return idSelector;
  }

  const path: string[] = [];
  let node: Element | null = el;

  while (node && node.nodeType === 1 && node !== document.body) {
    let segment = node.tagName.toLowerCase();

    const menuId = node.getAttribute('data-menu-id');
    if (menuId) {
      segment += `[data-menu-id="${escapeCss(menuId)}"]`;
    } else if (typeof node.className === 'string' && node.className.trim()) {
      const classes = node.className.trim().split(/\s+/).slice(0, 2);
      if (classes.length && classes[0]) {
        segment += '.' + classes.map((c) => escapeCss(c)).join('.');
      }
    }

    path.unshift(segment);
    const candidate = path.join(' > ');
    if (matchesTarget(candidate, el)) return candidate;

    const parent = node.parentElement;
    if (parent) {
      const idx = nthChildIndex(node);
      path[0] = segment + `:nth-child(${idx})`;
      const candidateWithIndex = path.join(' > ');
      if (matchesTarget(candidateWithIndex, el)) {
        return candidateWithIndex;
      }
    }

    node = node.parentElement;
  }

  const fallback = path.length ? path.join(' > ') : 'body';
  if (matchesTarget(fallback, el)) return fallback;

  const fullPath: string[] = [];
  let n: Element | null = el;
  while (n && n !== document.body && n !== document.documentElement) {
    const p: Element | null = n.parentElement;
    fullPath.unshift(`${n.tagName.toLowerCase()}:nth-child(${nthChildIndex(n)})`);
    n = p;
  }
  const full = 'body > ' + fullPath.join(' > ');
  return matchesTarget(full, el) ? full : 'body';
}

interface RectState {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PickedElement {
  selector: string;
  tagName: string;
  rect: RectState;
}

export default function DebugModeOverlay() {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState<boolean>(() => isDebugModeEnabled());
  const [menuKey, setMenuKey] = useState<string>('-');
  const [picking, setPicking] = useState<boolean>(false);
  const [picked, setPicked] = useState<PickedElement | null>(null);
  const [hoverRect, setHoverRect] = useState<RectState | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(isDebugModeEnabled());
    window.addEventListener('site-config-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('site-config-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !picking) return;

    const handleMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el !== document.documentElement && el !== document.body) {
        const r = el.getBoundingClientRect();
        setHoverRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      } else {
        setHoverRect(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === document.documentElement || el === document.body) return;
      if (containerRef.current && containerRef.current.contains(el)) return;

      const r = el.getBoundingClientRect();
      const selector = getUniqueSelector(el);
      setPicked({
        selector,
        tagName: el.tagName.toLowerCase(),
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      });
      setMenuKey(getSelectedMenuKey());
      setPicking(false);
      setHoverRect(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPicking(false);
        setHoverRect(null);
      }
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, picking]);

  if (!enabled) return null;

  const copySelector = async () => {
    if (!picked) return;
    try {
      await navigator.clipboard.writeText(picked.selector);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时忽略 */
    }
  };

  const startPicking = () => {
    setPicked(null);
    setPicking(true);
  };

  const highlightRect = hoverRect ?? picked?.rect ?? null;

  return createPortal(
    <>
      {highlightRect && (
        <div
          className={styles.highlight ?? ''}
          style={{
            left: highlightRect.left,
            top: highlightRect.top,
            width: highlightRect.width,
            height: highlightRect.height,
          }}
        />
      )}
      <div className={styles.container ?? ''} ref={containerRef}>
        <div className={styles.header ?? ''}>调试面板</div>
        <div className={styles.section ?? ''}>
          <div className={styles.row ?? ''}>
            <span className={styles.label ?? ''}>路径</span>
            <span className={styles.value ?? ''}>{location.pathname}</span>
          </div>
          <div className={styles.row ?? ''}>
            <span className={styles.label ?? ''}>标题</span>
            <span className={styles.value ?? ''}>{getRouteTitle(location.pathname) || '-'}</span>
          </div>
          <div className={styles.row ?? ''}>
            <span className={styles.label ?? ''}>菜单</span>
            <span className={styles.value ?? ''}>{menuKey}</span>
          </div>
        </div>
        <div className={styles.divider ?? ''} />
        <div className={styles.section ?? ''}>
          <div className={styles.sectionTitle ?? ''}>元素选择</div>
          {picking ? (
            <div className={styles.pickingHint ?? ''}>
              已进入选择模式：移动鼠标高亮目标，点击锁定，Esc 取消
            </div>
          ) : picked ? (
            <>
              <div className={styles.row ?? ''}>
                <span className={styles.label ?? ''}>标签</span>
                <span className={styles.value ?? ''}>{picked.tagName}</span>
              </div>
              <div className={styles.selectorBox ?? ''}>{picked.selector}</div>
              <div className={styles.btnRow ?? ''}>
                <button
                  type="button"
                  className={styles.copyBtn ?? ''}
                  onClick={copySelector}
                >
                  {copied ? '已复制' : '复制选择器'}
                </button>
                <button
                  type="button"
                  className={styles.copyBtn ?? ''}
                  onClick={startPicking}
                >
                  重新选择
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className={styles.copyBtn ?? ''}
              onClick={startPicking}
            >
              选择元素
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
