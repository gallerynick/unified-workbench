# 拓扑查看/编辑模式切换计划

## 需求描述

用户点击拓扑图后应进入**查看模式**，此时：
- 只能移动画布和缩放画布
- 不可以编辑（不能添加/删除/移动节点，不能连线）
- 需要点击操作区第一分区最右边的**编辑按钮**才会切换到编辑模式
- 编辑模式下才显示编辑工具和组件库

## 修改文件

- `项目文件/frontend/src/pages/topology/TopologyManagement.tsx`

## 具体修改步骤

### 1. 修改 loadTopology 函数（约第140-148行）

将 `setIsEditing(true)` 改为 `setIsEditing(false)`，并设置 `setToolMode('move')`：

```tsx
const loadTopology = (topology: Topology) => {
    setCurrentTopology(topology);
    setTopologyName(topology.name);
    setTopologyType(topology.topology_type as TopologyType || 'custom');
    setNodes(topology.nodes ?? []);
    setEdges(topology.edges ?? []);
    setSelectedNode(null);
    setIsEditing(false);  // 改为 false，进入查看模式
    setToolMode('move');  // 默认移动模式
  };
```

### 2. 修改工具栏渲染逻辑（约第365-409行）

将工具栏分为两种模式：

**查看模式**（isEditing === false）：
- 第一分区：隐藏列表按钮 + **编辑按钮**（最右边）
- 第二分区：放大/缩小按钮

**编辑模式**（isEditing === true）：
- 第一分区：隐藏列表按钮 + 选择/移动/连线/删除 + 编辑按钮（高亮状态）
- 第二分区：拓扑组件库
- 第三分区：放大/缩小

需要导入 `EditOutlined` 图标。

### 3. 修改画布事件处理

在查看模式下：
- `handleNodeMouseDown` 不应允许拖拽节点
- `handleSvgMouseDown` 只允许画布平移（move 模式）
- 不应允许添加节点

在 `handleNodeMouseDown` 函数开头添加：
```tsx
if (!isEditing) return;
```

在 `addNode` 函数开头添加：
```tsx
if (!isEditing) return;
```

### 4. 修改 SVG 画布的 cursor 样式

查看模式下画布 cursor 应该是 `grab`/`grabbing`（因为只能平移）：
```tsx
style={{ cursor: toolMode === 'move' || !isEditing ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
```

### 5. 修改画布节点渲染

查看模式下节点不应显示拖拽 cursor：
```tsx
style={{ cursor: isEditing && toolMode !== 'move' ? 'move' : 'default' }}
```

## 验证清单

- [x] 1. 点击拓扑列表中的拓扑 → 进入查看模式（工具栏只有列表切换、编辑、缩放按钮）
- [x] 2. 查看模式下拖拽画布 → 可以平移
- [x] 3. 查看模式下滚轮缩放 → 可以缩放
- [x] 4. 查看模式下点击节点 → 不可拖拽
- [x] 5. 点击编辑按钮 → 切换到编辑模式（显示所有编辑工具和组件库）
- [x] 6. 编辑模式下可以正常编辑节点、连线、删除
- [x] 7. 点击"返回列表" → 退出查看/编辑模式
- [x] 8. 新建拓扑 → 直接进入编辑模式
- [x] 9. 前端构建通过
- [x] 10. 后端健康检查返回 200
