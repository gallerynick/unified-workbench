import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Typography, Modal, message, Space, Input, Tooltip, Spin, Tag, List, Card } from 'antd';
import { SaveOutlined, ZoomInOutlined, ZoomOutOutlined, PlusOutlined, DeleteOutlined, ApartmentOutlined, DesktopOutlined, NodeIndexOutlined, DragOutlined, LinkOutlined, ExpandOutlined, ShrinkOutlined, AimOutlined, AppstoreOutlined, EditOutlined } from '@ant-design/icons';
import { listTopologies, createTopology, updateTopology, deleteTopology } from '../../api/topology';
import type { Topology, TopologyNode, TopologyEdge, TopologyNodeType, TopologyType } from '../../types/topology';
import styles from './TopologyManagement.module.css';

import routerSvg from '../../assets/topology-icons/router.svg?raw';
import switchSvg from '../../assets/topology-icons/switch.svg?raw';
import serverSvg from '../../assets/topology-icons/server.svg?raw';
import computerSvg from '../../assets/topology-icons/computer.svg?raw';
import smartphoneSvg from '../../assets/topology-icons/smartphone.svg?raw';
import tabletSvg from '../../assets/topology-icons/tablet.svg?raw';

const { Title } = Typography;

type ToolMode = 'select' | 'move' | 'connect' | 'delete';
type PanelType = 'tools' | 'nodes' | null;

const TOPOLOGY_TYPES: { type: TopologyType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: 'device', label: '设备拓扑', icon: <DesktopOutlined />, description: '使用设备图标（路由器、交换机、服务器等）' },
  { type: 'network', label: '网络拓扑', icon: <NodeIndexOutlined />, description: '使用网络图标（路由器、交换机、服务器、电脑等）' },
  { type: 'custom', label: '自定义拓扑', icon: <ApartmentOutlined />, description: '使用典型图形（圆形、矩形、菱形等）' },
];

const NETWORK_SVGS: Record<TopologyNodeType, string> = {
  router: routerSvg,
  switch: switchSvg,
  server: serverSvg,
  device: computerSvg,
  cloud: smartphoneSvg,
  firewall: tabletSvg,
};

const DEVICE_NODE_TYPES: { type: TopologyNodeType; label: string; color: string; icon: string }[] = [
  { type: 'router', label: '路由器', color: '#1677ff', icon: '⬡' },
  { type: 'switch', label: '交换机', color: '#52c41a', icon: '⬢' },
  { type: 'server', label: '服务器', color: '#722ed1', icon: '⬜' },
  { type: 'firewall', label: '防火墙', color: '#f5222d', icon: '🔺' },
  { type: 'device', label: '终端设备', color: '#fa8c16', icon: '⬛' },
  { type: 'cloud', label: '云服务', color: '#13c2c2', icon: '☁' },
];

const NETWORK_NODE_TYPES: { type: TopologyNodeType; label: string; color: string }[] = [
  { type: 'router', label: '路由器', color: '#1677ff' },
  { type: 'switch', label: '交换机', color: '#52c41a' },
  { type: 'server', label: '服务器', color: '#722ed1' },
  { type: 'device', label: '电脑', color: '#fa8c16' },
  { type: 'cloud', label: '手机', color: '#13c2c2' },
  { type: 'firewall', label: '平板', color: '#f5222d' },
];

const CUSTOM_NODE_TYPES: { type: TopologyNodeType; label: string; color: string; icon: string }[] = [
  { type: 'device', label: '圆形', color: '#1677ff', icon: '●' },
  { type: 'server', label: '矩形', color: '#52c41a', icon: '■' },
  { type: 'firewall', label: '菱形', color: '#f5222d', icon: '◆' },
  { type: 'cloud', label: '椭圆', color: '#13c2c2', icon: '⬭' },
  { type: 'router', label: '六边形', color: '#722ed1', icon: '⬡' },
  { type: 'switch', label: '三角形', color: '#fa8c16', icon: '▲' },
];

function getNodeTypes(topologyType: TopologyType): typeof DEVICE_NODE_TYPES {
  switch (topologyType) {
    case 'device': return DEVICE_NODE_TYPES;
    case 'network': return NETWORK_NODE_TYPES as unknown as typeof DEVICE_NODE_TYPES;
    case 'custom': return CUSTOM_NODE_TYPES;
    default: return DEVICE_NODE_TYPES;
  }
}

function getNodeColor(type: TopologyNodeType, topologyType: TopologyType): string {
  return getNodeTypes(topologyType).find((t) => t.type === type)?.color ?? '#1677ff';
}

function getNodeIcon(type: TopologyNodeType, topologyType: TopologyType): string {
  return getNodeTypes(topologyType).find((t) => t.type === type)?.icon ?? '⬜';
}

function getNodeSvg(type: TopologyNodeType): string | null {
  return NETWORK_SVGS[type] ?? null;
}

function getTopologyTypeLabel(type: TopologyType): string {
  return TOPOLOGY_TYPES.find((t) => t.type === type)?.label ?? '未知';
}

function getTopologyTypeColor(type: TopologyType): string {
  switch (type) {
    case 'device': return 'blue';
    case 'network': return 'green';
    case 'custom': return 'default';
    default: return 'default';
  }
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
  const [topologyType, setTopologyType] = useState<TopologyType>('custom');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<{ source: string; x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTopologyName, setNewTopologyName] = useState('');
  const [newTopologyType, setNewTopologyType] = useState<TopologyType>('custom');
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [expandedPanel, setExpandedPanel] = useState<PanelType>('nodes');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
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
    setCurrentTopology(topology);
    setTopologyName(topology.name);
    setTopologyType(topology.topology_type as TopologyType || 'custom');
    const topoNodes = topology.nodes ?? [];
    const topoEdges = topology.edges ?? [];
    setNodes(topoNodes);
    setEdges(topoEdges);
    setOriginalNodes(topoNodes);
    setOriginalEdges(topoEdges);
    setSelectedNode(null);
    setIsEditing(false);
    setToolMode('move');
  };

  const handleCreate = () => {
    if (!newTopologyName.trim()) { message.warning('请输入拓扑名称'); return; }
    setCurrentTopology(null);
    setTopologyName(newTopologyName);
    setTopologyType(newTopologyType);
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setOriginalNodes([]);
    setOriginalEdges([]);
    setCreateModalVisible(false);
    setNewTopologyName('');
    setIsEditing(true);
    message.info('已进入编辑模式，请添加节点后点击保存');
  };

  const handleSave = async () => {
    if (!topologyName.trim()) { message.warning('请输入拓扑名称'); return; }
    setSaving(true);
    try {
      if (currentTopology) {
        const res = await updateTopology(currentTopology.id, { name: topologyName, nodes, edges });
        if (res.code === 0) {
          message.success('已保存');
          setCurrentTopology(res.data);
          setOriginalNodes(nodes);
          setOriginalEdges(edges);
        }
      } else {
        const res = await createTopology({ name: topologyName, topology_type: topologyType, nodes, edges });
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

  const handleExitEdit = () => {
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
      label: getNodeTypes(topologyType).find((t) => t.type === type)?.label ?? '节点',
      type,
    };
    setNodes([...nodes, newNode]);
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

  const nodeTypes = getNodeTypes(topologyType);

  return (
    <div className={styles.container}>
      {contextHolder}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Title level={4} className={styles.title ?? ''}>拓扑结构</Title>
          {isEditing && (
            <>
              <Input value={topologyName} onChange={(e) => setTopologyName(e.target.value)} style={{ width: 160 }} placeholder="拓扑名称" />
              <Tag color={getTopologyTypeColor(topologyType)}>{getTopologyTypeLabel(topologyType)}</Tag>
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
                    <div>
                      <div className={styles.topologyName}>{item.name}</div>
                      <Tag color={getTopologyTypeColor(item.topology_type as TopologyType)}>{getTopologyTypeLabel(item.topology_type as TopologyType)}</Tag>
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
                    <div className={styles.toolDivider} />
                    <div className={styles.toolGroup}>
                      <Tooltip title="拓扑组件库">
                        <button type="button" className={`${styles.toolIcon} ${expandedPanel === 'nodes' ? styles.toolIconActive : ''}`} onClick={() => setExpandedPanel(expandedPanel === 'nodes' ? null : 'nodes')}>
                          <AppstoreOutlined />
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
                    <button type="button" className={`${styles.toolIcon} ${isEditing ? styles.toolIconActive : ''}`} onClick={handleExitEdit}>
                      <EditOutlined />
                    </button>
                  </Tooltip>
                </div>
              </div>

              <div className={styles.canvasArea}>
                {isEditing && expandedPanel === 'nodes' && (
                  <div className={styles.nodePanel}>
                    {nodeTypes.map((t) => {
                      const svgContent = topologyType === 'network' ? getNodeSvg(t.type) : null;
                      return (
                        <Tooltip key={t.type} title={t.label}>
                          <button type="button" className={styles.nodeItem} onClick={() => addNode(t.type)}>
                            {svgContent ? (
                              <span style={{ width: 18, height: 18, color: t.color, display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: svgContent }} />
                            ) : (
                              <span style={{ color: t.color, fontSize: 18 }}>{t.icon}</span>
                            )}
                          </button>
                        </Tooltip>
                      );
                    })}
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
                      <polygon points="0 0, 10 3.5, 0 7" fill="#8c8c8c" />
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
                          stroke="#8c8c8c" strokeWidth={2}
                          markerEnd="url(#arrowhead)"
                          className={styles.edge}
                          onClick={() => isEditing && toolMode === 'delete' && handleDeleteEdge(edge.id)}
                        />
                      );
                    })}
                    {connecting && (
                      <line x1={connecting.x} y1={connecting.y} x2={mousePos.x} y2={mousePos.y} stroke="#1677ff" strokeWidth={2} strokeDasharray="6" />
                    )}
                    {nodes.map((node) => {
                      const svgContent = topologyType === 'network' ? getNodeSvg(node.type) : null;
                      return (
                        <g key={node.id} transform={`translate(${node.x}, ${node.y})`} onMouseDown={(e) => handleNodeMouseDown(node.id, e)} className={styles.node}>
                          <circle r={24} fill={getNodeColor(node.type, topologyType)} stroke={selectedNode === node.id ? '#000' : 'transparent'} strokeWidth={2} opacity={0.9} style={{ cursor: isEditing && toolMode !== 'move' ? 'move' : 'default' }} />
                          <text textAnchor="middle" dy={-32} fontSize={12} fill="currentColor" className={styles.nodeLabel}>{node.label}</text>
                          {svgContent ? (
                            <foreignObject x={-12} y={-12} width={24} height={24} style={{ pointerEvents: 'none' }}>
                              <div style={{ width: 24, height: 24, color: '#fff' }} dangerouslySetInnerHTML={{ __html: svgContent }} />
                            </foreignObject>
                          ) : (
                            <text textAnchor="middle" dy={5} fontSize={16} fill="#fff">{getNodeIcon(node.type, topologyType)}</text>
                          )}
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
              <ApartmentOutlined style={{ fontSize: 48, color: '#999', marginBottom: 16 }} />
              <div>选择一个拓扑或创建新拓扑开始编辑</div>
            </div>
          )}
        </div>
      </div>

      <Modal title="新建拓扑" open={createModalVisible} onOk={handleCreate} onCancel={() => setCreateModalVisible(false)} okText="创建" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input placeholder="拓扑名称" value={newTopologyName} onChange={(e) => setNewTopologyName(e.target.value)} />
          <div>
            <div style={{ marginBottom: 8 }}>选择拓扑类型：</div>
            <Space wrap>
              {TOPOLOGY_TYPES.map((t) => (
                <Card
                  key={t.type}
                  hoverable
                  style={{ width: 150, borderColor: newTopologyType === t.type ? '#1677ff' : undefined }}
                  onClick={() => setNewTopologyType(t.type)}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{t.icon}</div>
                    <div style={{ fontWeight: 500 }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{t.description}</div>
                  </div>
                </Card>
              ))}
            </Space>
          </div>
        </Space>
      </Modal>
    </div>
  );
}
