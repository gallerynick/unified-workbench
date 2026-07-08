import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button, Typography, Modal, message, Space, Input, Tooltip, Spin, Tag, List, AutoComplete } from 'antd';
import { SaveOutlined, ZoomInOutlined, ZoomOutOutlined, PlusOutlined, DeleteOutlined, ApartmentOutlined, DragOutlined, LinkOutlined, ExpandOutlined, ShrinkOutlined, AimOutlined, AppstoreOutlined, EditOutlined } from '@ant-design/icons';
import { listTopologies, createTopology, updateTopology, deleteTopology } from '../../api/topology';
import type { Topology, TopologyNode, TopologyEdge, TopologyNodeType, TopologyShape } from '../../types/topology';
import styles from './TopologyManagement.module.css';
import routerSvg from '../../assets/topology-icons/router.svg?raw';
import switchSvg from '../../assets/topology-icons/switch.svg?raw';
import serverSvg from '../../assets/topology-icons/server.svg?raw';
import computerSvg from '../../assets/topology-icons/computer.svg?raw';
import smartphoneSvg from '../../assets/topology-icons/smartphone.svg?raw';
import headphoneSvg from '../../assets/topology-icons/headphone.svg?raw';
import internetSvg from '../../assets/topology-icons/internet.svg?raw';
import keyboardSvg from '../../assets/topology-icons/keyboard.svg?raw';
import mouseSvg from '../../assets/topology-icons/mouse.svg?raw';
import printerSvg from '../../assets/topology-icons/printer.svg?raw';
import projectorSvg from '../../assets/topology-icons/projector.svg?raw';
import speakerSvg from '../../assets/topology-icons/speaker.svg?raw';
import televisionSvg from '../../assets/topology-icons/television.svg?raw';

const { Title } = Typography;

type ToolMode = 'select' | 'move' | 'connect' | 'delete';
type PanelType = 'tools' | 'nodes' | null;

const DEVICE_SVGS: Record<TopologyNodeType, string> = {
  router: routerSvg,
  switch: switchSvg,
  server: serverSvg,
  computer: computerSvg,
  smartphone: smartphoneSvg,
  headphone: headphoneSvg,
  internet: internetSvg,
  keyboard: keyboardSvg,
  mouse: mouseSvg,
  printer: printerSvg,
  projector: projectorSvg,
  speaker: speakerSvg,
  television: televisionSvg,
  custom: '',
};

const DEVICE_NODE_TYPES: { type: TopologyNodeType; label: string; color: string; icon?: string }[] = [
  { type: 'router', label: '路由器', color: 'var(--color-info)' },
  { type: 'switch', label: '交换机', color: '#52c41a' },
  { type: 'server', label: '服务器', color: '#722ed1' },
  { type: 'computer', label: '电脑', color: '#fa8c16' },
  { type: 'smartphone', label: '手机', color: '#13c2c2' },
  { type: 'headphone', label: '耳机', color: '#eb2f96' },
  { type: 'internet', label: '互联网', color: '#2f54eb' },
  { type: 'keyboard', label: '键盘', color: '#fa541c' },
  { type: 'mouse', label: '鼠标', color: '#a0d911' },
  { type: 'printer', label: '打印机', color: '#531dab' },
  { type: 'projector', label: '投影仪', color: '#fadb14' },
  { type: 'speaker', label: '音箱', color: '#597ef7' },
  { type: 'television', label: '电视', color: '#ff85c0' },
];

const SHAPES: { type: TopologyShape; label: string }[] = [
  { type: 'circle', label: '圆形' },
  { type: 'rectangle', label: '矩形' },
  { type: 'diamond', label: '菱形' },
  { type: 'hexagon', label: '六边形' },
  { type: 'triangle', label: '三角形' },
];

const PRESET_COLORS = ['var(--color-info)', 'var(--color-success)', 'var(--color-purple)', 'var(--color-orange)', 'var(--color-cyan)', 'var(--color-red)'];

function getNodeColor(type: TopologyNodeType): string {
  return DEVICE_NODE_TYPES.find((t) => t.type === type)?.color ?? 'var(--color-info)';
}

function getNodeSvg(type: TopologyNodeType): string | null {
  return DEVICE_SVGS[type] ?? null;
}

export default function TopologyManagement() {
  const [modal, contextHolder] = Modal.useModal();
  const [topologies, setTopologies] = useState<Topology[]>([]);
  const [currentTopology, setCurrentTopology] = useState<Topology | null>(null);
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [edges, setEdges] = useState<TopologyEdge[]>([]);
  const [originalNodes, setOriginalNodes] = useState<TopologyNode[]>([]);
  const [originalEdges, setOriginalEdges] = useState<TopologyEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [topologyName, setTopologyName] = useState('未命名拓扑');
  const [topologyCategory, setTopologyCategory] = useState('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<{ source: string; x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTopologyName, setNewTopologyName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [expandedPanel, setExpandedPanel] = useState<PanelType>('nodes');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [customShape, setCustomShape] = useState<TopologyShape>('circle');
  const [customColor, setCustomColor] = useState('var(--color-info)');
  const [customLabel, setCustomLabel] = useState('');
  const [systemExpanded, setSystemExpanded] = useState(true);
  const [customExpanded, setCustomExpanded] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchTopologies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTopologies({ page: 1, page_size: 100 });
      if (res.code === 0) {
        setTopologies(res.data.items);
      }
    } catch {
      message.error('获取拓扑列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTopologies(); }, [fetchTopologies]);

  const loadTopology = (topology: Topology) => {
    if (!topology) return;
    setCurrentTopology(topology);
    setTopologyName(topology.name);
    setTopologyCategory(topology.category || '');
    const topoNodes = Array.isArray(topology.nodes) ? topology.nodes : [];
    const topoEdges = Array.isArray(topology.edges) ? topology.edges : [];
    setNodes(topoNodes);
    setEdges(topoEdges);
    setOriginalNodes(topoNodes);
    setOriginalEdges(topoEdges);
    setSelectedNode(null);
    setIsEditing(false);
    setToolMode('select');
  };

  const handleCreate = () => {
    if (!newTopologyName.trim()) { message.warning('请输入拓扑名称'); return; }
    setCurrentTopology({
      id: '',
      name: newTopologyName,
      description: null,
      category: newCategory,
      nodes: [],
      edges: [],
      owner_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setTopologyName(newTopologyName);
    setTopologyCategory(newCategory);
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setOriginalNodes([]);
    setOriginalEdges([]);
    setCreateModalVisible(false);
    setNewTopologyName('');
    setNewCategory('');
    setIsEditing(true);
    message.info('已进入编辑模式，请添加节点后点击保存');
  };

  const handleSave = async () => {
    if (!topologyName.trim()) { message.warning('请输入拓扑名称'); return; }
    setSaving(true);
    try {
      if (currentTopology?.id) {
        const res = await updateTopology(currentTopology.id, { name: topologyName, category: topologyCategory, nodes, edges });
        if (res.code === 0) {
          message.success('已保存');
          setCurrentTopology(res.data);
          setOriginalNodes(nodes);
          setOriginalEdges(edges);
        }
      } else {
        const res = await createTopology({ name: topologyName, category: topologyCategory, nodes, edges });
        if (res.code === 0) {
          message.success('已创建');
          setCurrentTopology(res.data);
          setOriginalNodes(nodes);
          setOriginalEdges(edges);
          fetchTopologies();
        }
      }
    } catch { message.error('保存失败'); }
    finally { setSaving(false); }
  };

  const hasChanges = () => {
    return JSON.stringify(nodes) !== JSON.stringify(originalNodes) ||
           JSON.stringify(edges) !== JSON.stringify(originalEdges);
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      if (hasChanges()) {
        modal.confirm({
          title: '未保存的修改',
          content: '当前拓扑有未保存的修改，是否保存？',
          okText: '保存',
          cancelText: '不保存',
          onOk: async () => {
            await handleSave();
            setIsEditing(false);
            setToolMode('move');
            setOriginalNodes(nodes);
            setOriginalEdges(edges);
          },
          onCancel: () => {
            setIsEditing(false);
            setToolMode('move');
            setOriginalNodes(nodes);
            setOriginalEdges(edges);
          },
        });
      } else {
        setIsEditing(false);
        setToolMode('move');
      }
    } else {
      setOriginalNodes(nodes);
      setOriginalEdges(edges);
      setIsEditing(true);
    }
  };

  const handleDelete = (topology: Topology) => {
    modal.confirm({
      title: '确认删除', content: `确定要删除拓扑「${topology.name}」吗？`,
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteTopology(topology.id);
          if (res.code === 0) { message.success('已删除'); fetchTopologies(); if (currentTopology?.id === topology.id) setCurrentTopology(null); }
        } catch { message.error('删除失败'); }
      },
    });
  };

  const addNode = (type: TopologyNodeType) => {
    if (!isEditing) return;
    const id = `node_${Date.now()}`;
    const newNode: TopologyNode = {
      id, x: 200 + Math.random() * 200, y: 150 + Math.random() * 200,
      label: DEVICE_NODE_TYPES.find((t) => t.type === type)?.label ?? '节点',
      type,
    };
    setNodes([...nodes, newNode]);
  };

  const addCustomNode = () => {
    if (!isEditing || !customLabel.trim()) { message.warning('请输入节点文字'); return; }
    const id = `node_${Date.now()}`;
    const newNode: TopologyNode = {
      id, x: 200 + Math.random() * 200, y: 150 + Math.random() * 200,
      label: customLabel,
      type: 'custom',
      shape: customShape,
      customColor,
    };
    setNodes([...nodes, newNode]);
    setCustomLabel('');
    setCustomShape('circle');
    setCustomColor('var(--color-info)');
  };

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current) {
      if (toolMode === 'move') {
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      } else {
        setSelectedNode(null);
        setConnecting(null);
      }
    }
  };

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if (!isEditing) return;
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (toolMode === 'delete') {
      setNodes(nodes.filter((n) => n.id !== nodeId));
      setEdges(edges.filter((ed) => ed.source !== nodeId && ed.target !== nodeId));
      return;
    }

    if (toolMode === 'connect') {
      setConnecting({ source: nodeId, x: node.x, y: node.y });
      return;
    }

    if (toolMode === 'select' || toolMode === 'move') {
      setSelectedNode(nodeId);
      setDragNode(nodeId);
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (svgRect) {
        setDragOffset({
          x: (e.clientX - svgRect.left) / zoom - panOffset.x / zoom - node.x,
          y: (e.clientY - svgRect.top) / zoom - panOffset.y / zoom - node.y,
        });
      }
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const x = (e.clientX - svgRect.left - panOffset.x) / zoom;
    const y = (e.clientY - svgRect.top - panOffset.y) / zoom;
    setMousePos({ x, y });

    if (isPanning) {
      setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (dragNode) {
      setNodes(nodes.map((n) => n.id === dragNode ? { ...n, x: x - dragOffset.x, y: y - dragOffset.y } : n));
    }
  };

  const handleSvgMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (connecting) {
      const target = nodes.find((n) => {
        const dx = n.x - mousePos.x;
        const dy = n.y - mousePos.y;
        return Math.sqrt(dx * dx + dy * dy) < 30 && n.id !== connecting.source;
      });
      if (target) {
        const exists = edges.some((ed) =>
          (ed.source === connecting.source && ed.target === target.id) ||
          (ed.source === target.id && ed.target === connecting.source)
        );
        if (!exists) {
          setEdges([...edges, { id: `edge_${Date.now()}`, source: connecting.source, target: target.id }]);
        }
      }
      setConnecting(null);
    }
    setDragNode(null);
  };

  const handleDeleteEdge = (edgeId: string) => {
    setEdges(edges.filter((e) => e.id !== edgeId));
  };

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rawDelta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      const delta = -rawDelta * 0.005;
      const current = zoomRef.current;
      const next = Math.min(Math.max(current + delta, 0.3), 2);
      setZoom(next);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);



  const existingCategories = useMemo(() => {
    const cats = new Set(topologies.map(t => t.category).filter(Boolean));
    return Array.from(cats).map(c => ({ value: c, label: c }));
  }, [topologies]);

  return (
    <div className={styles.container}>
      {contextHolder}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Title level={4} className={styles.title ?? ''}>拓扑结构</Title>
          {isEditing && (
            <>
              <Input value={topologyName} onChange={(e) => setTopologyName(e.target.value)} style={{ width: 160 }} placeholder="拓扑名称" />
            </>
          )}
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>新建拓扑</Button>
          {isEditing && (
            <>
              <Button icon={<SaveOutlined />} onClick={handleSave} loading={saving}>保存</Button>
              <Button onClick={() => { setIsEditing(false); setSidebarVisible(true); }}>返回列表</Button>
            </>
          )}
        </Space>
      </div>

      <div className={styles.editor}>
        {sidebarVisible && (
          <div className={styles.sidebar}>
            <div className={styles.sidebarTitle}>拓扑列表</div>
            {loading ? <Spin /> : (
              <List
                size="small"
                split={false}
                dataSource={topologies}
                locale={{ emptyText: '暂无拓扑' }}
                renderItem={(item) => (
                  <List.Item
                    className={`${styles.topologyItem} ${currentTopology?.id === item.id ? styles.topologyItemActive : ''}`}
                    onClick={() => loadTopology(item)}
                    actions={[
                      <Button key="delete" type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); handleDelete(item); }} />
                    ]}
                  >
                    <div className={styles.topologyItemContent}>
                      <div className={styles.topologyName}>{item.name}</div>
                      {item.category && <Tag>{item.category}</Tag>}
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
        )}

        <div className={styles.canvasWrapper}>
          {currentTopology ? (
            <>
              <div className={styles.toolBar}>
                <div className={styles.toolGroup}>
                  <Tooltip title={sidebarVisible ? '隐藏列表' : '显示列表'}>
                    <button type="button" className={styles.toolIcon} onClick={() => setSidebarVisible(!sidebarVisible)}>
                      {sidebarVisible ? <ShrinkOutlined /> : <ExpandOutlined />}
                    </button>
                  </Tooltip>
                </div>
                {isEditing && (
                  <>
                    <div className={styles.toolDivider} />
                    <div className={styles.toolGroup}>
                      <Tooltip title="拓扑组件库">
                        <button type="button" className={`${styles.toolIcon} ${expandedPanel === 'nodes' ? styles.toolIconActive : ''}`} onClick={() => setExpandedPanel(expandedPanel === 'nodes' ? null : 'nodes')}>
                          <AppstoreOutlined />
                        </button>
                      </Tooltip>
                    </div>
                    <div className={styles.toolDivider} />
                    <div className={styles.toolGroup}>
                      <Tooltip title="选择">
                        <button type="button" className={`${styles.toolIcon} ${toolMode === 'select' ? styles.toolIconActive : ''}`} onClick={() => setToolMode('select')}>
                          <AimOutlined />
                        </button>
                      </Tooltip>
                      <Tooltip title="移动画布">
                        <button type="button" className={`${styles.toolIcon} ${toolMode === 'move' ? styles.toolIconActive : ''}`} onClick={() => setToolMode('move')}>
                          <DragOutlined />
                        </button>
                      </Tooltip>
                      <Tooltip title="连线">
                        <button type="button" className={`${styles.toolIcon} ${toolMode === 'connect' ? styles.toolIconActive : ''}`} onClick={() => setToolMode('connect')}>
                          <LinkOutlined />
                        </button>
                      </Tooltip>
                      <Tooltip title="删除">
                        <button type="button" className={`${styles.toolIcon} ${toolMode === 'delete' ? styles.toolIconActive : ''}`} onClick={() => setToolMode('delete')}>
                          <DeleteOutlined />
                        </button>
                      </Tooltip>
                    </div>
                  </>
                )}
                <div className={styles.toolDivider} />
                <div className={styles.toolGroup}>
                  <Tooltip title={`放大 (${Math.round(zoom * 100)}%)`}><button type="button" className={styles.toolIcon} onClick={() => setZoom(Math.min(zoom + 0.1, 2))}><ZoomInOutlined /></button></Tooltip>
                  <Tooltip title={`缩小 (${Math.round(zoom * 100)}%)`}><button type="button" className={styles.toolIcon} onClick={() => setZoom(Math.max(zoom - 0.1, 0.3))}><ZoomOutOutlined /></button></Tooltip>
                </div>
                <div className={styles.toolDivider} />
                <div className={styles.toolGroup}>
                  <Tooltip title="编辑">
                    <button type="button" className={`${styles.toolIcon} ${isEditing ? styles.toolIconActive : ''}`} onClick={handleToggleEdit}>
                      <EditOutlined />
                    </button>
                  </Tooltip>
                </div>
              </div>

              <div className={styles.canvasArea}>
                {isEditing && expandedPanel === 'nodes' && (
                  <div className={styles.nodePanel}>
                    <div className={styles.panelSection}>
                      <div className={styles.panelSectionTitle} onClick={() => setSystemExpanded(!systemExpanded)}>
                        <span>系统组件库</span>
                        <span className={styles.collapseArrow} style={{ transform: systemExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▲</span>
                      </div>
                      {systemExpanded && (
                        <div className={styles.shapeGrid}>
                          {DEVICE_NODE_TYPES.map((t) => {
                            const svgContent = getNodeSvg(t.type);
                            return (
                              <Tooltip key={t.type} title={t.label}>
                                <button type="button" className={styles.shapeItem} onClick={() => addNode(t.type)}>
                                  {svgContent ? (
                                    <span style={{ width: 18, height: 18, color: t.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: svgContent }} />
                                  ) : null}
                                  <span className={styles.deviceLabel}>{t.label}</span>
                                </button>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className={styles.panelDivider} />

                    <div className={styles.panelSection}>
                      <div className={styles.panelSectionTitle} onClick={() => setCustomExpanded(!customExpanded)}>
                        <span>自定义节点</span>
                        <span className={styles.collapseArrow} style={{ transform: customExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▲</span>
                      </div>
                      {customExpanded && (
                        <>
                          <div className={styles.customRow}>
                            <span className={styles.customLabel}>形状</span>
                        <div className={styles.shapeGrid}>
                              {SHAPES.map((s) => (
                                <button
                                  key={s.type}
                                  type="button"
                                  className={`${styles.shapeItem} ${customShape === s.type ? styles.shapeItemActive : ''}`}
                                  onClick={() => setCustomShape(s.type)}
                                  title={s.label}
                                >
                                  <svg width={24} height={24} viewBox="-14 -14 28 28">
                                    {s.type === 'circle' && <circle r={12} fill="none" stroke={customShape === s.type ? 'var(--color-info)' : 'var(--text-secondary)'} strokeWidth={customShape === s.type ? 2 : 1.5} />}
                                    {s.type === 'rectangle' && <rect x={-14} y={-10} width={28} height={20} rx={3} fill="none" stroke={customShape === s.type ? 'var(--color-info)' : 'var(--text-secondary)'} strokeWidth={customShape === s.type ? 2 : 1.5} />}
                                    {s.type === 'diamond' && <polygon points="0,-14 14,0 0,14 -14,0" fill="none" stroke={customShape === s.type ? 'var(--color-info)' : 'var(--text-secondary)'} strokeWidth={customShape === s.type ? 2 : 1.5} />}
                                    {s.type === 'hexagon' && <polygon points="0,-13 11.3,-6.5 11.3,6.5 0,13 -11.3,6.5 -11.3,-6.5" fill="none" stroke={customShape === s.type ? 'var(--color-info)' : 'var(--text-secondary)'} strokeWidth={customShape === s.type ? 2 : 1.5} />}
                                    {s.type === 'triangle' && <polygon points="0,-14 14,14 -14,14" fill="none" stroke={customShape === s.type ? 'var(--color-info)' : 'var(--text-secondary)'} strokeWidth={customShape === s.type ? 2 : 1.5} />}
                                  </svg>
                                  <span className={styles.shapeLabel}>{s.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className={styles.customRow}>
                            <span className={styles.customLabel}>颜色</span>
                            <div className={styles.colorSwatches}>
                              {PRESET_COLORS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  className={`${styles.colorSwatch} ${customColor === c ? styles.colorSwatchActive : ''}`}
                                  style={{ backgroundColor: c }}
                                  onClick={() => setCustomColor(c)}
                                  title={c}
                                />
                              ))}
                            </div>
                          </div>
                          <div className={styles.customRow}>
                            <span className={styles.customLabel}>文字</span>
                            <Input size="small" placeholder="节点文字" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
                          </div>
                          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addCustomNode} block>添加到画布</Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <svg
                  ref={svgRef}
                  className={styles.canvas}
                  onMouseDown={handleSvgMouseDown}
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={handleSvgMouseUp}
                  onMouseLeave={() => { setIsPanning(false); setDragNode(null); }}
                  style={{ cursor: !isEditing || toolMode === 'move' ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
                  role="img"
                  aria-label="拓扑画布"
                >
                  <title>拓扑画布</title>
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-secondary)" />
                    </marker>
                  </defs>
                  <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
                    {edges.map((edge) => {
                      const source = nodes.find((n) => n.id === edge.source);
                      const target = nodes.find((n) => n.id === edge.target);
                      if (!source || !target) return null;
                      return (
                        <line
                          key={edge.id}
                          x1={source.x} y1={source.y}
                          x2={target.x} y2={target.y}
                          stroke="var(--text-secondary)" strokeWidth={2}
                          markerEnd="url(#arrowhead)"
                          className={styles.edge}
                          onClick={() => isEditing && toolMode === 'delete' && handleDeleteEdge(edge.id)}
                        />
                      );
                    })}
                    {connecting && (
                      <line x1={connecting.x} y1={connecting.y} x2={mousePos.x} y2={mousePos.y} stroke="var(--color-info)" strokeWidth={2} strokeDasharray="6" />
                    )}
                    {nodes.map((node) => {
                      const svgContent = getNodeSvg(node.type);
                      const isCustom = !!node.shape;
                      const fillColor = isCustom ? (node.customColor || 'var(--color-info)') : getNodeColor(node.type);
                      return (
                        <g key={node.id} transform={`translate(${node.x}, ${node.y})`} onMouseDown={(e) => handleNodeMouseDown(node.id, e)} className={styles.node}>
    {/* Shape rendering: custom nodes = hexagon base + shape icon overlay */}
    {isCustom ? (
      <>
        {/* 底层：始终为六边形，自定义颜色填充 */}
        <polygon points="0,-24 21,-12 21,12 0,24 -21,12 -21,-12" fill={fillColor} stroke={selectedNode === node.id ? 'currentColor' : 'transparent'} strokeWidth={2} opacity={0.9} />
        {/* 上层：选中形状的白色小图标，居中叠加 */}
        {node.shape === 'circle' && <circle r={10} fill="none" stroke="var(--body-on-dark)" strokeWidth={2} opacity={0.85} />}
        {node.shape === 'rectangle' && <rect x={-12} y={-8} width={24} height={16} rx={3} fill="none" stroke="var(--body-on-dark)" strokeWidth={2} opacity={0.85} />}
        {node.shape === 'diamond' && <polygon points="0,-12 12,0 0,12 -12,0" fill="none" stroke="var(--body-on-dark)" strokeWidth={2} opacity={0.85} />}
        {node.shape === 'hexagon' && <polygon points="0,-10 9,-5 9,5 0,10 -9,5 -9,-5" fill="none" stroke="var(--body-on-dark)" strokeWidth={2} opacity={0.85} />}
        {node.shape === 'triangle' && <polygon points="0,-12 12,12 -12,12" fill="none" stroke="var(--body-on-dark)" strokeWidth={2} opacity={0.85} />}
      </>
    ) : (
      <circle r={24} fill={fillColor} stroke={selectedNode === node.id ? 'currentColor' : 'transparent'} strokeWidth={2} opacity={0.9} style={{ cursor: isEditing && toolMode !== 'move' ? 'move' : 'default' }} />
    )}
    {/* Label */}
    <text textAnchor="middle" dy={-32} fontSize={12} fill="currentColor" className={styles.nodeLabel}>{node.label}</text>
    {/* SVG icon (device nodes only) */}
    {!isCustom && svgContent ? (
                            <foreignObject x={-12} y={-12} width={24} height={24} style={{ pointerEvents: 'none' }}>
                              <div style={{ width: 24, height: 24, color: 'var(--body-on-dark)' }} dangerouslySetInnerHTML={{ __html: svgContent }} />
                            </foreignObject>
                          ) : null}
                          {/* IP address */}
                          {node.ip && <text textAnchor="middle" dy={40} fontSize={10} fill="currentColor" className={styles.nodeIp}>{node.ip}</text>}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <ApartmentOutlined style={{ fontSize: 48, color: 'var(--text-secondary)', marginBottom: "var(--spacing-card-gap)" }} />
              <div>选择一个拓扑或创建新拓扑开始编辑</div>
            </div>
          )}
        </div>
      </div>

      <Modal title="新建拓扑" open={createModalVisible} onOk={handleCreate} onCancel={() => { setCreateModalVisible(false); setNewTopologyName(''); setNewCategory(''); }} okText="创建" cancelText="取消" width={480} styles={{ body: { paddingBottom: "var(--spacing-card-gap)" } }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ marginBottom: "var(--spacing-xxs)", fontSize: 'var(--text-body-mono-size)', color: 'var(--text-secondary)' }}>拓扑名称</div>
            <Input placeholder="输入拓扑名称" value={newTopologyName} onChange={(e) => setNewTopologyName(e.target.value)} />
          </div>
          <div>
            <div style={{ marginBottom: "var(--spacing-xxs)", fontSize: 'var(--text-body-mono-size)', color: 'var(--text-secondary)' }}>分类标签（可选）</div>
            <AutoComplete
              style={{ width: '100%' }}
              placeholder="输入分类名称或选择已有分类"
              value={newCategory}
              onChange={(val) => setNewCategory(val)}
              options={existingCategories}
              allowClear
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
