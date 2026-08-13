# 深色模式背景色同步 + 离线地图项目

## TL;DR (For humans)

1. **深色模式背景色修复**：`global.css` 缺少 `body`/`html` 背景色 → 深色模式白色；外层 `<Layout>` 缺少背景色 → 同样白色
2. **离线地图项目**：基于 OSM + MapLibre GL + TileServer-GL 的中国全境离线街道地图，Docker Compose 一键部署。**文件创建暂缓**，等用户通知后再补全

---

## 任务 1：深色模式背景色同步

### 问题根因
- `global.css` 无 `body`/`html` 背景色声明 → 浏览器默认白色
- `MainLayout.tsx:163` 外层 `<Layout>` 无 `background` 样式 → Ant Design Layout 默认白色
- 深色模式下 `colorBgContainer`（Ant Design token）已正确变为深色，但未被应用到根容器

### 修复方案

#### 1.1 `global.css` 添加 body/html 背景色
```css
html, body {
  margin: 0;
  padding: 0;
  background-color: #ffffff;
  color: rgba(0, 0, 0, 0.88);
  transition: background-color 0.3s, color 0.3s;
}

[data-theme="dark"] html,
[data-theme="dark"] body {
  background-color: #141414;
  color: rgba(255, 255, 255, 0.85);
}

#root {
  min-height: 100vh;
}
```

#### 1.2 `MainLayout.tsx` 外层 Layout 添加背景色
- 第 163 行：`<Layout style={{ minHeight: '100vh' }}>` → 添加 `background: colorBgLayout`
- 从 `theme.useToken()` 解构 `colorBgLayout` token（深色模式下自动变为深色）

```tsx
const {
  token: { colorBgContainer, colorBgLayout, borderRadiusLG },
} = theme.useToken();
```

```tsx
<Layout style={{ minHeight: '100vh', background: colorBgLayout }}>
```

### 验收标准
- 浅色模式：背景白色，无变化
- 深色模式：背景 `#141414`，无白色区域
- 切换主题时平滑过渡（0.3s transition）

---

## 任务 2：离线地图项目（暂缓文件创建）

### 项目结构
```
项目文件/offline-map/
├── docker-compose.yml
├── data/
│   └── .gitkeep
├── www/
│   ├── index.html
│   ├── style.json
│   └── README.md
└── README.md
```

### 技术栈
- TileServer-GL（瓦片服务端）
- MapLibre GL JS（前端渲染）
- OpenStreetMap 数据（ODbL 许可）
- tilemaker（生成 mbtiles）

### 部署架构
```
Docker Compose
├── tileserver-gl 容器（端口 8080）
│   └── data/china.mbtiles
└── nginx 容器（端口 8090）
    └── www/ 静态文件
```

### 状态
**暂缓** — 等用户通知后再创建文件

---

## 执行计划

| Wave | 任务 | 依赖 | 委派 |
|------|------|------|------|
| 1 | 修改 global.css + MainLayout.tsx | 无 | task(category="quick") |
| 2 | 构建部署验证 | Wave 1 | 直接执行 |
| 3 | 离线地图文件创建 | 暂缓 | 等用户通知 |
