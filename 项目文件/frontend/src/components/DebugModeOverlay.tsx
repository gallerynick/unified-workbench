import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

/**
 * 当前页面缩放比例（CSS zoom），未缩放时返回 1。
 *
 * 页面缩放（见 hooks/usePageZoom.ts）作用在 documentElement 上，属布局时缩放：
 * getBoundingClientRect() / clientX 返回的是【缩放后的视觉坐标】，
 * 而 CSS 的 left/top/width 与 window.innerWidth 属于【未缩放的布局坐标】，
 * 两者相差一个 zoom 因子。混用会导致面板拖不到边缘、高亮框与目标元素错位。
 *
 * 本文件所有 pos / rect 状态统一存【布局坐标】，在读取 getBoundingClientRect
 * 与计算视口范围时换算，渲染处无需再转换。
 */
function pageZoomScale(): number {
  const v = parseFloat(document.documentElement.style.zoom);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

/** 把 getBoundingClientRect() 的视觉坐标换算为 CSS 布局坐标 */
function toLayoutRect(r: DOMRect): RectState {
  const z = pageZoomScale();
  return {
    left: r.left / z,
    top: r.top / z,
    width: r.width / z,
    height: r.height / z,
  };
}

/* ====== 面板拖拽 / 收纳 ====== */
const PANEL_WIDTH = 340;
const EDGE = 16;
const STORAGE_KEY = 'debug-panel-state';

/** CSS width:340px 是 content-box，左右 padding 各 14px，border-box 布局宽 368px */
const PANEL_BOX_WIDTH = PANEL_WIDTH + 28;

/** 面板高度兜底值：仅用于首次测量完成前的渲染钳制，测到真实值后随即替换 */
const PANEL_HEIGHT_FALLBACK = 240;

/** 布局视口尺寸。缩放写在 documentElement 上，innerWidth 并不随之变化 */
function viewportSize(): { w: number; h: number } {
  const z = pageZoomScale();
  return { w: window.innerWidth / z, h: window.innerHeight / z };
}

/**
 * 把位置钳制进视口：上下左右四个方向都不允许越界。
 * 入参 x/y/width/height 与返回值均为布局坐标，vp 为布局视口。
 *
 * width/height 必须传面板的【实测】布局尺寸，不能用固定常量——面板高度随
 * 内容变化（进入选择模式、选择器文本换行、按钮行增减），用常量必然在一边
 * 留缝或穿透边界。
 *
 * 纯函数、无副作用：只算出「该怎么放」，绝不回写意图位置 pos。
 */
function clampPos(
  x: number,
  y: number,
  width: number,
  height: number,
  vp: { w: number; h: number },
): PanelPos {
  return {
    x: Math.min(Math.max(EDGE, x), Math.max(EDGE, vp.w - width - EDGE)),
    y: Math.min(Math.max(EDGE, y), Math.max(EDGE, vp.h - height - EDGE)),
  };
}

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
  // 意图位置：用户拖到哪就记哪，只做持久化；边界钳制只作用于渲染位置，绝不回写这里
  const [pos, setPos] = useState<PanelPos | null>(() => loadPanelState().pos);
  const [minimized, setMinimized] = useState<boolean>(() => loadPanelState().minimized);
  const [dragging, setDragging] = useState<boolean>(false);
  const [pendingRestore, setPendingRestore] = useState<'left' | 'right' | null>(null);
  const dragRef = useRef({ offsetX: 0, offsetY: 0 });
  // 面板实测布局尺寸；首次测量完成前用 CSS 已知宽度 + 高度兜底值参与钳制
  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>({
    width: PANEL_BOX_WIDTH,
    height: PANEL_HEIGHT_FALLBACK,
  });
  // 布局视口；窗口尺寸或页面缩放比例变化时更新，驱动渲染位置重算
  const [viewport, setViewport] = useState(() => viewportSize());

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

  // 量取面板实测布局尺寸与布局视口。钳制统一在渲染时做（见 renderPos），
  // 这里只负责把两个量保持最新——内容高度变化、窗口尺寸变化、页面缩放比例
  // 变化（含首屏异步下发的那次 zoom）都要覆盖。
  useLayoutEffect(() => {
    if (!enabled || minimized) return;
    const el = containerRef.current;
    if (!el) return;

    const refresh = () => {
      const z = pageZoomScale();
      const r = el.getBoundingClientRect();
      const size = { width: r.width / z, height: r.height / z };
      const vp = viewportSize();
      setPanelSize((s) => (s.width === size.width && s.height === size.height ? s : size));
      setViewport((v) => (v.w === vp.w && v.h === vp.h ? v : vp));
    };

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(refresh);
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    // 缩放写在 documentElement 的 style 上，观察它即可覆盖所有写入方——
    // usePageZoom 首屏异步下发那次并不派发 zoom-changed 事件，只监听事件会漏
    const mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', schedule);

    refresh();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, minimized]);

  // 收纳按钮停在哪一角，点击后就把面板意图位置设为那一角
  useLayoutEffect(() => {
    if (!pendingRestore) return;
    const el = containerRef.current;
    const z = pageZoomScale();
    const r = el?.getBoundingClientRect();
    const width = r ? r.width / z : PANEL_BOX_WIDTH;
    const height = r ? r.height / z : PANEL_HEIGHT_FALLBACK;
    const vp = viewportSize();
    setPos({
      x: pendingRestore === 'left' ? EDGE : vp.w - width - EDGE,
      y: vp.h - height - EDGE,
    });
    setPendingRestore(null);
  }, [pendingRestore]);

  // 拖拽移动（仅按住拖拽柄按钮触发）
  const startDrag = (e: ReactPointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    dragRef.current = {
      offsetX: rect ? e.clientX - rect.left : 0,
      offsetY: rect ? e.clientY - rect.top : 0,
    };
    setDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (ev: PointerEvent) => {
      const z = pageZoomScale();
      const { offsetX, offsetY } = dragRef.current;
      // 记录意图位置（clientX / offsetX 是视觉坐标，除以 zoom 换算到布局坐标）。
      // 这里不钳制：越界时渲染位置会被 clampPos 收住，内容变矮后自动归位。
      setPos({
        x: (ev.clientX - offsetX) / z,
        y: (ev.clientY - offsetY) / z,
      });
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
        setHoverRect(toLayoutRect(el.getBoundingClientRect()));
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

      const selector = getUniqueSelector(el);
      setPicked({
        selector,
        tagName: el.tagName.toLowerCase(),
        rect: toLayoutRect(el.getBoundingClientRect()),
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

  // 意图位置 → 渲染位置：按面板实测尺寸与布局视口钳制，四条边都不越界。
  // 关键在「只算不写」：内容变高时渲染位置被顶上来，内容变矮后同一个意图
  // 位置不再需要上移，面板自动回到原位（回写 pos 的做法会把它永久卡在上位）。
  const renderPos = pos ? clampPos(pos.x, pos.y, panelSize.width, panelSize.height, viewport) : null;

  // 收纳后小按钮停靠在哪一侧：按面板渲染位置中心在左半屏还是右半屏决定；未拖拽过时默认停右下（与面板默认位一致）
  const viewportCenter = viewport.w / 2;
  const panelOnLeft = renderPos ? renderPos.x + PANEL_WIDTH / 2 < viewportCenter : false;
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
          onClick={() => {
            setPendingRestore(panelOnLeft ? 'left' : 'right');
            setMinimized(false);
          }}
          title="展开调试面板"
          aria-label="展开调试面板"
        >
          <ToolOutlined />
          <span>调试</span>
        </button>
      ) : (
        <div
          className={styles.container ?? ''}
          style={renderPos ? { left: renderPos.x, top: renderPos.y, bottom: 'auto' } : undefined}
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
