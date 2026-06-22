import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-2d';
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
  '#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16',
  '#E86452', '#6DC8EC', '#945FB9', '#FF9845',
  '#1E9493', '#FF99C3',
];

function categoryColor(category: string | null): string {
  if (!category) return '#999';
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = ((hash << 5) - hash) + category.charCodeAt(i);
    hash |= 0;
  }
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length] ?? '#999';
}

export default function GraphView({ notes, onNodeClick, isDark, search }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<NodeObject<GraphNodeData>, GraphLinkData> | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

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

    // 找到匹配的节点
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

    // 包含匹配节点的邻居（父级和子级）
    graphData.links.forEach((link) => {
      if (matchedIds.has(link.source)) matchedIds.add(link.target);
      if (matchedIds.has(link.target)) matchedIds.add(link.source);
    });

    return {
      nodes: graphData.nodes.filter((n) => matchedIds.has(n.id)),
      links: graphData.links.filter((l) => matchedIds.has(l.source) && matchedIds.has(l.target)),
    };
  }, [graphData, search]);

  // 力模拟配置
  useEffect(() => {
    if (initialized.current || !graphRef.current) return;
    initialized.current = true;
    const fg = graphRef.current;
    fg.d3Force('charge')?.strength(-300);
    fg.d3Force('link')?.distance(60);
    fg.d3ReheatSimulation();
  }, []);

  // 数据变更时 zoomToFit
  useEffect(() => {
    if (graphRef.current && filteredData.nodes.length > 0) {
      const timer = setTimeout(() => {
        graphRef.current?.zoomToFit(400, 30);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filteredData]);

  // 初始化完成
  useEffect(() => {
    if (graphData.nodes.length >= 0) {
      const timer = setTimeout(() => setLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [graphData]);

  // 自定义 Canvas 节点渲染
  const nodeCanvasObject = useCallback((node: NodeObject<GraphNodeData>, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const radius = Math.log(node.degree + 2) * 3 + 4;
    const color = categoryColor(node.category);

    // 绘制节点圆形
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // 置顶笔记绘制金色环形边框
    if (node.isPinned) {
      ctx.strokeStyle = '#fa8c16';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 缩放时显示标签
    if (globalScale >= 0.8) {
      const fontSize = Math.min(14, Math.max(8, 12 / globalScale));
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // 标签背景
      const label = node.name;
      const textWidth = ctx.measureText(label).width;
      const bgPadding = 2;
      ctx.fillStyle = isDark ? 'rgba(31,31,31,0.8)' : 'rgba(255,255,255,0.8)';
      ctx.fillRect(x - textWidth / 2 - bgPadding, y + radius + 2, textWidth + bgPadding * 2, fontSize + bgPadding * 2);

      // 标签文字
      ctx.fillStyle = isDark ? '#e0e0e0' : '#333';
      ctx.fillText(label, x, y + radius + 4);
    }
  }, [isDark]);

  // 命中检测
  const nodePointerAreaPaint = useCallback((node: NodeObject<GraphNodeData>, color: string, ctx: CanvasRenderingContext2D) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const radius = Math.log(node.degree + 2) * 3 + 4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  // 节点点击
  const handleNodeClick = useCallback((node: NodeObject<GraphNodeData>) => {
    onNodeClick(node.note);
  }, [onNodeClick]);

  // 主题颜色
  const bgColor = isDark ? '#1f1f1f' : '#ffffff';
  const linkColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';

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
        onNodeClick={handleNodeClick}
        linkDirectionalArrowLength={6}
        linkColor={() => linkColor}
        backgroundColor={bgColor}
        autoPauseRedraw={true}
        warmupTicks={150}
        cooldownTime={10000}
        minZoom={0.1}
        maxZoom={8}
      />
    </div>
  );
}
