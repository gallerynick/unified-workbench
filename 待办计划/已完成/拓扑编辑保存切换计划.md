# 拓扑编辑模式切换保存提示计划

## 需求描述

进入编辑模式后，再次点击编辑按钮可以关闭编辑模式（回到查看模式）。
如果有修改（节点或连线有变动），则提示是否保存。

## 修改文件

- `项目文件/frontend/src/pages/topology/TopologyManagement.tsx`

## 具体修改步骤

### 1. 添加原始数据状态追踪

在组件状态中添加 `originalNodes` 和 `originalEdges` 用于追踪原始数据：

```tsx
const [originalNodes, setOriginalNodes] = useState<TopologyNode[]>([]);
const [originalEdges, setOriginalEdges] = useState<TopologyEdge[]>([]);
```

### 2. 修改 loadTopology 函数

保存原始数据：

```tsx
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
```

### 3. 修改 handleCreate 函数

新建拓扑时清空原始数据：

```tsx
const handleCreate = () => {
    // ... 现有逻辑 ...
    setOriginalNodes([]);
    setOriginalEdges([]);
    // ... 现有逻辑 ...
  };
```

### 4. 添加检查是否有修改的函数

```tsx
const hasChanges = () => {
    return JSON.stringify(nodes) !== JSON.stringify(originalNodes) ||
           JSON.stringify(edges) !== JSON.stringify(originalEdges);
  };
```

### 5. 添加退出编辑模式的处理函数

```tsx
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
```

### 6. 修改工具栏中编辑按钮的 onClick

将编辑按钮从只设置 `setIsEditing(true)` 改为调用 `handleExitEdit`：

```tsx
<Tooltip title="编辑">
  <button type="button" className={`${styles.toolIcon} ${isEditing ? styles.toolIconActive : ''}`} onClick={handleExitEdit}>
    <EditOutlined />
  </button>
</Tooltip>
```

### 7. 修改 handleSave 函数

保存成功后更新原始数据：

```tsx
const handleSave = async () => {
    // ... 现有逻辑 ...
    if (res.code === 0) {
      message.success('已保存');
      setCurrentTopology(res.data);
      setOriginalNodes(nodes);
      setOriginalEdges(edges);
    }
    // ... 现有逻辑 ...
  };
```

## 验证清单

- [x] 1. 点击拓扑 → 进入查看模式
- [x] 2. 点击编辑按钮 → 进入编辑模式
- [x] 3. 编辑模式下修改节点/连线
- [x] 4. 再次点击编辑按钮 → 弹出保存提示
- [x] 5. 点击"保存" → 保存并退出编辑模式
- [x] 6. 点击"不保存" → 不保存直接退出编辑模式
- [x] 7. 没有修改时点击编辑按钮 → 直接退出编辑模式
- [x] 8. 新建拓扑 → 直接进入编辑模式
- [x] 9. 前端构建通过
- [x] 10. 后端健康检查返回 200
