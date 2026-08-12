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

export default function DebugModeOverlay() {
  const location = useLocation();
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState<boolean>(() => isDebugModeEnabled());
  const [menuKey, setMenuKey] = useState<string>('-');
  const [selector, setSelector] = useState<string>('-');
  const [tagName, setTagName] = useState<string>('-');
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rect, setRect] = useState<RectState | null>(null);
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
    const handleMouseMove = (e: MouseEvent) => {
      if (!enabled) return;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setMousePos({ x: e.clientX, y: e.clientY });
        setMenuKey(getSelectedMenuKey());
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && el !== document.documentElement && el !== document.body) {
          if (containerRef.current && containerRef.current.contains(el)) {
            setRect(null);
            return;
          }
          setSelector(getUniqueSelector(el));
          setTagName(el.tagName.toLowerCase());
          const r = el.getBoundingClientRect();
          setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
        } else {
          setSelector(el?.tagName?.toLowerCase() ?? '-');
          setTagName(el?.tagName?.toLowerCase() ?? '-');
          setRect(null);
        }
      });
    };

    const handleScroll = () => {
      setRect(null);
      setSelector('-');
      setTagName('-');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('scroll', handleScroll, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]);

  if (!enabled) return null;

  const copySelector = async () => {
    try {
      await navigator.clipboard.writeText(selector);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时忽略 */
    }
  };

  return createPortal(
    <>
      {rect && (
        <div
          className={styles.highlight ?? ''}
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
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
          <div className={styles.sectionTitle ?? ''}>悬停元素</div>
          <div className={styles.row ?? ''}>
            <span className={styles.label ?? ''}>标签</span>
            <span className={styles.value ?? ''}>{tagName}</span>
          </div>
          <div className={styles.row ?? ''}>
            <span className={styles.label ?? ''}>鼠标</span>
            <span className={styles.value ?? ''}>
              ({mousePos.x}, {mousePos.y})
            </span>
          </div>
          <div className={styles.selectorBox ?? ''}>{selector}</div>
          <button
            type="button"
            className={styles.copyBtn ?? ''}
            onClick={copySelector}
            disabled={selector === '-'}
          >
            {copied ? '已复制' : '复制选择器'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
