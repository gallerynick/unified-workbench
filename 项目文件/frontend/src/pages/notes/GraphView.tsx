import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods, LinkObject, NodeObject } from 'react-force-graph-2d';
import { Empty, Input, Select, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { GraphData } from '@/types/note';
import styles from './GraphView.module.css';

interface GraphViewProps {
  /** 图谱数据由后端 note_link 服务提供，边来源仅 wikilink */
  graph: GraphData;
  onNodeClick: (noteId: string) => void;
}

/** 力导向图内部节点：在后端节点基础上补算 degree 供节点半径使用 */
interface GraphNodeData {
  id: string;
  name: string;
  /** 所属文件夹名，取第一个作为分组依据；空数组即未分类 */
  folders: string[];
  isPinned: boolean;
  degree: number;
}

interface GraphLinkData {
  source: string;
  target: string;
}

const SEARCH_DEBOUNCE_MS = 250;
const LEGEND_MAX_ITEMS = 12;

type ColorMode = 'folder' | 'none';

/** 节点分组键：取首个文件夹名，未分类记为空串 */
function groupKey(node: GraphNodeData): string {
  return node.folders[0] ?? '';
}

const UNFILED_LABEL = '未分类';

function readTokens(): { bg: string; text: string; textSecondary: string; warning: string } {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  return {
    bg: style.getPropertyValue('--canvas-parchment').trim() || 'var(--canvas-parchment)',
    text: style.getPropertyValue('--text-primary').trim() || 'var(--text-primary)',
    textSecondary: style.getPropertyValue('--text-secondary').trim() || 'var(--text-secondary)',
    warning: style.getPropertyValue('--color-warning').trim() || 'var(--color-warning)',
  };
}

/** canvas 无法直接使用 CSS var，运行时将 token 引用解析为具体颜色值 */
function resolveCssVar(cssVar: string): string {
  const m = /^var\((--[^)]+)\)$/.exec(cssVar);
  if (!m?.[1]) return cssVar;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || cssVar;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m?.[1] || !m?.[2] || !m?.[3]) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

const NODE_PALETTE = [
  'var(--color-indigo)', 'var(--color-violet)', 'var(--color-purple)', 'var(--color-magenta)',
  'var(--color-rose)', 'var(--color-red)', 'var(--color-orange)', 'var(--color-gold)',
  'var(--color-lime)', 'var(--color-cyan)', 'var(--color-info)', 'var(--color-cornflower)',
];

/** 节点基础半径：按链接数对数增长，孤立节点保持最小可读尺寸 */
function nodeRadius(degree: number): number {
  return Math.log(degree + 2) * 4 + 6;
}

export default function GraphView({ graph, onNodeClick }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<NodeObject<GraphNodeData>, GraphLinkData> | undefined>(undefined);
  // 初始为 0：useLayoutEffect 会在首次绘制前量出真实尺寸，
  // 避免 ForceGraph2D 先按 800x600 布局、等 ResizeObserver 回调再跳变
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const hoveredNeighbors = useRef<Set<string>>(new Set());
  const [colorMode, setColorMode] = useState<ColorMode>('folder');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { isDark } = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- readTokens 从 :root 读取 CSS 变量，随 data-theme 切换而变化
  const tokens = useMemo(() => readTokens(), [isDark]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveCssVar 同样依赖 :root 上的主题变量
  const palette = useMemo(() => NODE_PALETTE.map(resolveCssVar), [isDark]);
  const textSecondaryRgb = useMemo(() => hexToRgb(tokens.textSecondary) ?? { r: 140, g: 140, b: 140 }, [tokens.textSecondary]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const apply = (width: number, height: number) => {
      if (width > 0 && height > 0) setDimensions({ width, height });
    };

    const rect = container.getBoundingClientRect();
    apply(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        apply(width, height);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /** 后端只返回节点与边，度数需在前端从 links 补算 */
  const graphData = useMemo(() => {
    const degree = new Map<string, number>();
    for (const node of graph.nodes) degree.set(node.id, 0);
    for (const link of graph.links) {
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
    }
    return {
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        name: node.title,
        folders: node.folders ?? [],
        isPinned: node.is_pinned,
        degree: degree.get(node.id) ?? 0,
      })),
      links: graph.links.map((link) => ({ source: link.source, target: link.target })),
    };
  }, [graph]);

  // 图例分组键取自全量节点，避免搜索过滤后颜色漂移
  const groupKeys = useMemo(() => {
    const seen: string[] = [];
    for (const node of graphData.nodes) {
      const key = groupKey(node);
      if (!seen.includes(key)) seen.push(key);
    }
    return seen;
  }, [graphData]);

  const colorByGroup = useMemo(() => {
    const map = new Map<string, string>();
    groupKeys.forEach((key, index) => {
      const color = palette[index % palette.length];
      if (color) map.set(key, color);
    });
    return map;
  }, [groupKeys, palette]);

  const nodeColor = useCallback(
    (node: GraphNodeData): string => {
      if (colorMode !== 'folder') return tokens.textSecondary;
      const color = colorByGroup.get(groupKey(node));
      return color ?? tokens.textSecondary;
    },
    [colorByGroup, colorMode, tokens.textSecondary],
  );

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 命中的节点及其一阶邻居：用于聚焦与弱化
  const searchMatches = useMemo(() => {
    const index = new Map<string, Set<string>>();
    for (const node of graphData.nodes) index.set(node.id, new Set());
    for (const link of graphData.links) {
      index.get(link.source)?.add(link.target);
      index.get(link.target)?.add(link.source);
    }
    if (searchQuery === '') return null;
    const lower = searchQuery.toLowerCase();
    const matched = new Set<string>();
    for (const node of graphData.nodes) {
      if (
        node.name.toLowerCase().includes(lower) ||
        node.folders.some((folder) => folder.toLowerCase().includes(lower))
      ) {
        matched.add(node.id);
      }
    }
    const focus = new Set(matched);
    for (const id of matched) {
      for (const neighbor of index.get(id) ?? []) focus.add(neighbor);
    }
    return { matched, focus };
  }, [graphData, searchQuery]);

  const neighborIndex = useMemo(() => {
    const index = new Map<string, Set<string>>();
    for (const node of graphData.nodes) index.set(node.id, new Set());
    for (const link of graphData.links) {
      index.get(link.source)?.add(link.target);
      index.get(link.target)?.add(link.source);
    }
    return index;
  }, [graphData]);

  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-400).distanceMax(300);
    fg.d3Force('link')?.distance(80).strength(0.5);
    fg.d3ReheatSimulation();
  }, []);

  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      const timer = setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [graphData]);

  const handleNodeHover = useCallback(
    (node: NodeObject<GraphNodeData> | null) => {
      if (node) {
        setHoveredNode(node.id);
        hoveredNeighbors.current = neighborIndex.get(node.id) ?? new Set();
      } else {
        setHoveredNode(null);
        hoveredNeighbors.current = new Set();
      }
    },
    [neighborIndex],
  );

  const nodeCanvasObject = useCallback(
    (node: NodeObject<GraphNodeData>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const baseRadius = nodeRadius(node.degree);
      const color = nodeColor(node);
      const isHovered = hoveredNode === node.id;
      const isNeighbor = hoveredNeighbors.current.has(node.id);
      const isDimmed =
        (hoveredNode !== null && !isHovered && !isNeighbor) ||
        (searchMatches !== null && !searchMatches.focus.has(node.id));

      const radius = isHovered ? baseRadius * 1.2 : baseRadius;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = isDimmed ? 0.18 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isDimmed) return;

      if (node.isPinned) {
        ctx.strokeStyle = tokens.warning;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (globalScale >= 0.6) {
        const fontSize = Math.min(14, Math.max(10, 12 / globalScale));
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = tokens.text;
        ctx.fillText(node.name, x, y + radius + 4);
      }
    },
    [hoveredNode, searchMatches, tokens, nodeColor],
  );

  const nodePointerAreaPaint = useCallback(
    (node: NodeObject<GraphNodeData>, color: string, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const radius = nodeRadius(node.degree) * 1.2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  const linkCanvasObject = useCallback(
    (link: LinkObject<GraphNodeData, GraphLinkData>, ctx: CanvasRenderingContext2D) => {
      const source = link.source as NodeObject<GraphNodeData>;
      const target = link.target as NodeObject<GraphNodeData>;
      const sx = source.x ?? 0;
      const sy = source.y ?? 0;
      const tx = target.x ?? 0;
      const ty = target.y ?? 0;

      const isDimmed =
        (hoveredNode !== null &&
          hoveredNode !== source.id &&
          hoveredNode !== target.id &&
          !hoveredNeighbors.current.has(source.id) &&
          !hoveredNeighbors.current.has(target.id)) ||
        (searchMatches !== null &&
          !(searchMatches.focus.has(source.id) && searchMatches.focus.has(target.id)));

      const { r, g, b } = textSecondaryRgb;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = isDimmed ? `rgba(${r},${g},${b},0.08)` : `rgba(${r},${g},${b},0.35)`;
      ctx.lineWidth = isDimmed ? 1 : 2;
      ctx.stroke();

      if (isDimmed) return;

      const angle = Math.atan2(ty - sy, tx - sx);
      const arrowLen = 6;
      const arrowAngle = Math.PI / 6;
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;

      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx - arrowLen * Math.cos(angle - arrowAngle), my - arrowLen * Math.sin(angle - arrowAngle));
      ctx.moveTo(mx, my);
      ctx.lineTo(mx - arrowLen * Math.cos(angle + arrowAngle), my - arrowLen * Math.sin(angle + arrowAngle));
      ctx.strokeStyle = `rgba(${r},${g},${b},0.55)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    },
    [hoveredNode, searchMatches, textSecondaryRgb],
  );

  const handleNodeClick = useCallback(
    (node: NodeObject<GraphNodeData>) => {
      onNodeClick(node.id);
    },
    [onNodeClick],
  );

  if (graph.nodes.length === 0) {
    return (
      <div className={styles.emptyState ?? ''}>
        <Empty description="还没有笔记" />
      </div>
    );
  }

  const legendItems = groupKeys.slice(0, LEGEND_MAX_ITEMS);
  const legendOverflow = groupKeys.length - legendItems.length;
  const matchedCount = searchMatches?.matched.size ?? 0;

  return (
    <div ref={containerRef} className={styles.graphContainer ?? ''}>
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
          linkCanvasObject={linkCanvasObject}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          backgroundColor={tokens.bg}
          autoPauseRedraw={true}
          warmupTicks={200}
          cooldownTime={15000}
          minZoom={0.1}
          maxZoom={10}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />
      ) : null}

      <div className={styles.toolbar ?? ''}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索笔记或文件夹"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          allowClear
          variant="filled"
          className={styles.search ?? ''}
          aria-label="搜索图谱节点"
        />
        {searchQuery !== '' ? (
          <span className={styles.searchCount ?? ''}>
            {matchedCount} 个匹配
          </span>
        ) : null}
        <Tooltip title={colorMode === 'folder' ? '按文件夹着色' : '统一色'}>
          <Select
            size="small"
            value={colorMode}
            onChange={(value: ColorMode) => setColorMode(value)}
            options={[
              { value: 'folder', label: '按文件夹' },
              { value: 'none', label: '统一色' },
            ]}
            className={styles.colorMode ?? ''}
            aria-label="着色方式"
          />
        </Tooltip>
      </div>

      {legendItems.length > 0 ? (
        <div className={styles.legend ?? ''}>
          <div className={styles.legendTitle ?? ''}>图例</div>
          {legendItems.map((key) => (
            <div key={key === '' ? 'unfiled' : key} className={styles.legendItem ?? ''}>
              <span
                className={styles.legendDot ?? ''}
                style={{ background: colorByGroup.get(key) ?? tokens.textSecondary }}
              />
              <span className={styles.legendLabel ?? ''}>
                {key === '' ? UNFILED_LABEL : key}
              </span>
            </div>
          ))}
          {legendOverflow > 0 ? (
            <div className={styles.legendMore ?? ''}>还有 {legendOverflow} 组</div>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
