import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { Empty, Spin } from 'antd';
import type { Note } from '../../types/note';
import { notesToGraphData } from './notesToGraphData';
import type { GraphNodeData, GraphLinkData } from './notesToGraphData';
import styles from './GraphView.module.css';

interface GraphViewProps {
  notes: Note[];
  onNodeClick: (note: Note) => void;
  isDark: boolean;
  search?: string;
}

const CATEGORY_PALETTE = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

function categoryColor(category: string | null): string {
  if (!category) return 'var(--text-secondary)';
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = ((hash << 5) - hash) + category.charCodeAt(i);
    hash |= 0;
  }
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length] ?? 'var(--text-secondary)';
}

/** 读取 CSS 自定义属性用于 canvas 绘制（canvas 无法直接使用 CSS var） */
function readTokens(): { bg: string; text: string; textSecondary: string; warning: string } {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  return {
    bg: style.getPropertyValue('--canvas-parchment').trim() || 'var(--canvas-parchment)',
    text: style.getPropertyValue('--text-primary').trim() || 'var(--body)',
    textSecondary: style.getPropertyValue('--text-secondary').trim() || 'var(--text-secondary)',
    warning: style.getPropertyValue('--color-warning').trim() || 'var(--color-warning)',
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m?.[1] || !m?.[2] || !m?.[3]) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

export default function GraphView({ notes, onNodeClick, isDark: _isDark, search }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<NodeObject<GraphNodeData>, GraphLinkData> | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const hoveredNeighbors = useRef<Set<string>>(new Set());

  // 运行时读取 CSS token（每次渲染时重新读取，确保主题切换时更新）
  const tokens = readTokens();
  // 将 textSecondary hex 转为 rgb 分量用于 rgba 构造
  const textSecondaryRgb = useMemo(() => hexToRgb(tokens.textSecondary) ?? { r: 140, g: 140, b: 140 }, [tokens.textSecondary]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => notesToGraphData(notes), [notes]);

  const filteredData = useMemo(() => {
    if (!search) return graphData;
    const lower = search.toLowerCase();
    const matchedIds = new Set<string>();

    for (const node of graphData.nodes) {
      const note = node.note;
      if (
        note.title.toLowerCase().includes(lower) ||
        (note.content?.toLowerCase().includes(lower) ?? false) ||
        (note.category?.toLowerCase().includes(lower) ?? false)
      ) {
        matchedIds.add(node.id);
      }
    }

    for (const link of graphData.links) {
      if (matchedIds.has(link.source)) matchedIds.add(link.target);
      if (matchedIds.has(link.target)) matchedIds.add(link.source);
    }

    return {
      nodes: graphData.nodes.filter((n) => matchedIds.has(n.id)),
      links: graphData.links.filter((l) => matchedIds.has(l.source) && matchedIds.has(l.target)),
    };
  }, [graphData, search]);

  const neighborIndex = useMemo(() => {
    const index = new Map<string, Set<string>>();
    for (const n of filteredData.nodes) {
      index.set(n.id, new Set());
    }
    for (const l of filteredData.links) {
      index.get(l.source)?.add(l.target);
      index.get(l.target)?.add(l.source);
    }
    return index;
  }, [filteredData]);

  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-400).distanceMax(300);
    fg.d3Force('link')?.distance(80).strength(0.5);
    fg.d3ReheatSimulation();
  }, []);

  useEffect(() => {
    if (graphRef.current && filteredData.nodes.length > 0) {
      const timer = setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [filteredData]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleNodeHover = useCallback((node: NodeObject<GraphNodeData> | null) => {
    if (node) {
      setHoveredNode(node.id);
      hoveredNeighbors.current = neighborIndex.get(node.id) ?? new Set();
    } else {
      setHoveredNode(null);
      hoveredNeighbors.current = new Set();
    }
  }, [neighborIndex]);

  const nodeCanvasObject = useCallback((node: NodeObject<GraphNodeData>, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const baseRadius = Math.log(node.degree + 2) * 4 + 6;
    const color = categoryColor(node.category);
    const isHovered = hoveredNode === node.id;
    const isNeighbor = hoveredNeighbors.current.has(node.id);
    const isDimmed = hoveredNode !== null && !isHovered && !isNeighbor;

    const radius = isHovered ? baseRadius * 1.2 : baseRadius;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.globalAlpha = isDimmed ? 0.2 : 1;
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
      ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const label = node.name;

      ctx.fillStyle = tokens.text;
      ctx.fillText(label, x, y + radius + 4);
    }
  }, [hoveredNode, tokens]);

  const nodePointerAreaPaint = useCallback((node: NodeObject<GraphNodeData>, color: string, ctx: CanvasRenderingContext2D) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const radius = (Math.log(node.degree + 2) * 4 + 6) * 1.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  const linkCanvasObject = useCallback((link: LinkObject<GraphNodeData, GraphLinkData>, ctx: CanvasRenderingContext2D) => {
    const source = link.source as NodeObject<GraphNodeData>;
    const target = link.target as NodeObject<GraphNodeData>;
    const sx = source.x ?? 0;
    const sy = source.y ?? 0;
    const tx = target.x ?? 0;
    const ty = target.y ?? 0;

    const isDimmed = hoveredNode !== null &&
      hoveredNode !== source.id && hoveredNode !== target.id &&
      !hoveredNeighbors.current.has(source.id) && !hoveredNeighbors.current.has(target.id);

    const { r, g, b } = textSecondaryRgb;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = isDimmed
      ? `rgba(${r},${g},${b},0.1)`
      : `rgba(${r},${g},${b},0.35)`;
    ctx.lineWidth = isDimmed ? 1 : 2;
    ctx.stroke();

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
    ctx.strokeStyle = isDimmed
      ? `rgba(${r},${g},${b},0.15)`
      : `rgba(${r},${g},${b},0.55)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [hoveredNode, textSecondaryRgb]);

  const handleNodeClick = useCallback((node: NodeObject<GraphNodeData>) => {
    onNodeClick(node.note);
  }, [onNodeClick]);

  if (notes.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Empty description="还没有笔记" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.graphContainer}>
      {loading && (
        <div className={styles.loadingOverlay}>
          <Spin size="large" />
        </div>
      )}
      <ForceGraph2D
        ref={graphRef}
        graphData={filteredData}
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
    </div>
  );
}
