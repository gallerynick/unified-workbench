import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject, type LinkObject } from 'react-force-graph-2d';
import { Empty, Spin } from 'antd';
import type { Note } from '../../types/note';
import { notesToGraphData, type GraphNodeData, type GraphLinkData } from './notesToGraphData';
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
  if (!category) return '#94a3b8';
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = ((hash << 5) - hash) + category.charCodeAt(i);
    hash |= 0;
  }
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length] ?? '#94a3b8';
}

export default function GraphView({ notes, onNodeClick, isDark, search }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<NodeObject<GraphNodeData>, GraphLinkData> | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const hoveredNeighbors = useRef<Set<string>>(new Set());

  // 响应式尺寸调整
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

  // 转换数据
  const graphData = useMemo(() => notesToGraphData(notes), [notes]);

  // 搜索过滤
  const filteredData = useMemo(() => {
    if (!search) return graphData;
    const lower = search.toLowerCase();
    const matchedIds = new Set<string>();

    graphData.nodes.forEach((node) => {
      const note = node.note;
      if (
        note.title.toLowerCase().includes(lower) ||
        (note.content?.toLowerCase().includes(lower) ?? false) ||
        (note.category?.toLowerCase().includes(lower) ?? false)
      ) {
        matchedIds.add(node.id);
      }
    });

    graphData.links.forEach((link) => {
      if (matchedIds.has(link.source)) matchedIds.add(link.target);
      if (matchedIds.has(link.target)) matchedIds.add(link.source);
    });

    return {
      nodes: graphData.nodes.filter((n) => matchedIds.has(n.id)),
      links: graphData.links.filter((l) => matchedIds.has(l.source) && matchedIds.has(l.target)),
    };
  }, [graphData, search]);

  // 构建邻居索引
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

  // 力模拟配置
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-400).distanceMax(300);
    fg.d3Force('link')?.distance(80).strength(0.5);
    fg.d3ReheatSimulation();
  }, []);

  // 数据变更时 zoomToFit
  useEffect(() => {
    if (graphRef.current && filteredData.nodes.length > 0) {
      const timer = setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [filteredData]);

  // 初始化完成
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // 悬停处理
  const handleNodeHover = useCallback((node: NodeObject<GraphNodeData> | null) => {
    if (node) {
      setHoveredNode(node.id);
      hoveredNeighbors.current = neighborIndex.get(node.id) ?? new Set();
    } else {
      setHoveredNode(null);
      hoveredNeighbors.current = new Set();
    }
  }, [neighborIndex]);

  // 自定义 Canvas 节点渲染
  const nodeCanvasObject = useCallback((node: NodeObject<GraphNodeData>, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const baseRadius = Math.log(node.degree + 2) * 4 + 6;
    const color = categoryColor(node.category);
    const isHovered = hoveredNode === node.id;
    const isNeighbor = hoveredNeighbors.current.has(node.id);
    const isDimmed = hoveredNode !== null && !isHovered && !isNeighbor;

    // 计算实际半径（悬停时放大）
    const radius = isHovered ? baseRadius * 1.3 : baseRadius;

    // 发光效果（悬停时）
    if (isHovered) {
      const gradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 2.5);
      gradient.addColorStop(0, color + '80');
      gradient.addColorStop(1, color + '00');
      ctx.beginPath();
      ctx.arc(x, y, radius * 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // 节点主体（渐变）
    const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
    gradient.addColorStop(0, lightenColor(color, 30));
    gradient.addColorStop(1, color);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.globalAlpha = isDimmed ? 0.3 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;

    if (isDimmed) return;

    if (node.isPinned) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 边框
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 标签（缩放足够大时显示）
    if (globalScale >= 0.6 && !isDimmed) {
      const fontSize = Math.min(16, Math.max(10, 14 / globalScale));
      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const label = node.name;
      const textWidth = ctx.measureText(label).width;
      const bgPadding = 6;
      const bgRadius = 4;

      // 标签背景（圆角矩形）
      ctx.fillStyle = isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)';
      ctx.shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      roundRect(ctx, x - textWidth / 2 - bgPadding, y + radius + 6, textWidth + bgPadding * 2, fontSize + bgPadding * 2, bgRadius);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // 标签文字
      ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
      ctx.fillText(label, x, y + radius + 6 + bgPadding);
    }
  }, [isDark, hoveredNode]);

  // 命中检测
  const nodePointerAreaPaint = useCallback((node: NodeObject<GraphNodeData>, color: string, ctx: CanvasRenderingContext2D) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const radius = (Math.log(node.degree + 2) * 4 + 6) * 1.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  // 连线渲染
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

    // 渐变连线
    const gradient = ctx.createLinearGradient(sx, sy, tx, ty);
    const sourceColor = categoryColor(source.category);
    const targetColor = categoryColor(target.category);
    gradient.addColorStop(0, sourceColor + (isDimmed ? '20' : '60'));
    gradient.addColorStop(1, targetColor + (isDimmed ? '20' : '60'));

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = isDimmed ? 1 : 2;
    ctx.stroke();

    // 箭头
    const angle = Math.atan2(ty - sy, tx - sx);
    const arrowLen = 8;
    const arrowAngle = Math.PI / 6;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;

    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx - arrowLen * Math.cos(angle - arrowAngle), my - arrowLen * Math.sin(angle - arrowAngle));
    ctx.moveTo(mx, my);
    ctx.lineTo(mx - arrowLen * Math.cos(angle + arrowAngle), my - arrowLen * Math.sin(angle + arrowAngle));
    ctx.strokeStyle = targetColor + (isDimmed ? '40' : '80');
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [hoveredNode]);

  // 节点点击
  const handleNodeClick = useCallback((node: NodeObject<GraphNodeData>) => {
    onNodeClick(node.note);
  }, [onNodeClick]);

  // 主题颜色
  const bgColor = isDark ? '#0f172a' : '#f8fafc';

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
        backgroundColor={bgColor}
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

// 辅助函数：圆角矩形
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 辅助函数：颜色变亮
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
}
