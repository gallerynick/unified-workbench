import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { getRouteTitle } from '@/config/routeTitles';
import { isDebugModeEnabled } from '@/pages/settings/SiteSettings';
import { HolderOutlined, MinusOutlined, ToolOutlined } from '@ant-design/icons';
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
    const idSelector = '#' + escapeCss(el.id);
    if (matchesTarget(idSelector, el)) return idSelector;
  }

  const path: string[] = [];
  let node: Element | null = el;

  while (node && node.nodeType === 1 && node !== document.body) {
    let segment = node.tagName.toLowerCase();

    const menuId = node.getAttribute('data-menu-id');
    if (menuId) {
      segment += '[data-menu-id="' + escapeCss(menuId) + '"]';
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
      path[0] = segment + ':nth-child(' + idx + ')';
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
    fullPath.unshift(n.tagName.toLowerCase() + ':nth-child(' + nthChildIndex(n) + ')');
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

/* ====== 面板拖拽 / 收纳 ====== */
const PANEL_WIDTH = 340;
const EDGE = 16;
const STORAGE_KEY = 'debug-panel-state';

interface PanelPos {
  x: number;
  y: number;
}

interface StoredPanelState {
  pos: PanelPos | null;
  minimized: boolean;
}

function loadPanelState(): StoredPanelState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredPanelState;
      return {
        pos: parsed.pos ?? null,
        minimized: Boolean(parsed.minimized),
      };
    }
  } catch {
    // ignore
  }
  return { pos: null, minimized: false };
}

export default function DebugModeOverlay() {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const restoreBtnRef = useRef<HTMLButtonElement>(null);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [pos, setPos] = useState<PanelPos | null>(() => loadPanelState().pos);
  const [minimized, setMinimized] = useState<boolean>(() => loadPanelState().minimized);
  const [dragging, setDragging] = useState<boolean>(false);
  const dragRef = useRef({ startX: 0, startY: 0, offsetX: 0, offsetY: 0, width: PANEL_WIDTH, height: 0 });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const value = await isDebugModeEnabled();
      if (!cancelled) setEnabled(value);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 持久化面板位置与收纳状态
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ pos, minimized }));
    } catch {
      // ignore
    }
  }, [pos, minimized]);

  // 恢复时把越界位置拉回视口内
  useEffect(() => {
    if (pos) {
      const maxX = Math.max(EDGE, window.innerWidth - PANEL_WIDTH - EDGE);
      const maxY = Math.max(EDGE, window.innerHeight - 120);
      if (pos.x > maxX || pos.y > maxY) {
        setPos({ x: Math.min(pos.x, maxX), y: Math.min(pos.y, maxY) });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 拖拽移动（仅按住拖拽柄按钮触发）
  const startDrag = (e: ReactPointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: rect ? e.clientX - rect.left : 0,
      offsetY: rect ? e.clientY - rect.top : 0,
      width: rect?.width ?? PANEL_WIDTH,
      height: rect?.height ?? 0,
    };
    setDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (ev: PointerEvent) => {
      const { offsetX, offsetY, width } = dragRef.current;
      const maxX = Math.max(EDGE, window.innerWidth - width - EDGE);
      const maxY = Math.max(EDGE, window.innerHeight - 60);
      const x = Math.min(Math.max(EDGE, ev.clientX - offsetX), maxX);
      const y = Math.min(Math.max(EDGE, ev.clientY - offsetY), maxY);
      setPos({ x, y });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  const [menuKey, setMenuKey] = useState<string>('-');
  const [picking, setPicking] = useState<boolean>(false);
  const [picked, setPicked] = useState<PickedElement | null>(null);
  const [hoverRect, setHoverRect] = useState<RectState | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sync = () => {
      void (async () => {
        const value = await isDebugModeEnabled();
        setEnabled(value);
      })();
    };
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
      if (restoreBtnRef.current && restoreBtnRef.current.contains(el)) return;

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

  const clearPicked = () => {
    setPicked(null);
    setHoverRect(null);
  };

  const highlightRect = hoverRect ?? picked?.rect ?? null;

  // 收纳后小按钮停靠在哪一侧：按面板中心在左半屏还是右半屏决定；未拖拽过时默认停右下（与面板默认位一致）
  const panelOnLeft = pos ? pos.x + PANEL_WIDTH / 2 < window.innerWidth / 2 : false;
  const restoreStyle: React.CSSProperties = panelOnLeft
    ? { left: EDGE, bottom: EDGE }
    : { right: EDGE, bottom: EDGE };

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
      {minimized ? (
        <button
          ref={restoreBtnRef}
          type="button"
          className={styles.restoreBtn ?? ''}
          style={restoreStyle}
          onClick={() => setMinimized(false)}
          title="展开调试面板"
          aria-label="展开调试面板"
        >
          <ToolOutlined />
          <span>调试</span>
        </button>
      ) : (
        <div
          className={styles.container ?? ''}
          style={pos ? { left: pos.x, top: pos.y, bottom: 'auto' } : undefined}
          ref={containerRef}
        >
          <div
            className={"" + (styles.header ?? '') + (dragging ? (' ' + (styles.dragging ?? '')) : '')}
          >
            <button
              type="button"
              className={styles.dragBtn ?? ''}
              onPointerDown={startDrag}
              title="按住拖动面板"
              aria-label="按住拖动面板"
            >
              <HolderOutlined />
            </button>
            <span className={styles.headerTitle ?? ''}>调试面板</span>
            <button
              type="button"
              className={styles.minBtn ?? ''}
              onClick={() => setMinimized(true)}
              title="收纳面板"
              aria-label="收纳面板"
            >
              <MinusOutlined />
            </button>
          </div>
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
                  <button
                    type="button"
                    className={styles.copyBtn ?? ''}
                    onClick={clearPicked}
                  >
                    清除
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
      )}
    </>,
    document.body,
  );
}
