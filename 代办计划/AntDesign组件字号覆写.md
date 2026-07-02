# Ant Design 5 size="small" 组件字号覆写

## 背景

拓扑管理页面自定义节点区域有两个组件文字偏大，需要缩小字号：

- `<Input size="small" placeholder="节点文字" />`（`TopologyManagement.tsx:578`）
- `<Button type="primary" size="small">添加到画布</Button>`（`TopologyManagement.tsx:580`）

Ant Design `size="small"` 默认字号为 14px，目标缩小至 12px。

---

## 尝试过但无效的方案

### 方案 1：CSS Modules `:global()` 选择器

```css
.nodePanel :global(.ant-input-sm) {
  font-size: 12px;
}

.nodePanel :global(.ant-btn-sm) {
  font-size: 12px;
}
```

**失败原因**：Ant Design 5 使用 cssinjs（`@ant-design/cssinjs`）在运行时动态注入样式。CSS Modules 编译后的类名（如 `.nodePanel_HASH .ant-input-sm`）虽然选择器权重为 (0,2,0)，但 cssinjs 注入的样式哈希优先级更高，或被注入到文档流更靠后的位置，导致覆写无效。

### 方案 2：内联 `style` prop

```tsx
<Input size="small" style={{ fontSize: 12 }} placeholder="节点文字" />
<Button type="primary" size="small" style={{ fontSize: 12 }}>添加到画布</Button>
```

**失败原因**：
- **Input**：`style` prop 传递给外层 wrapper（`<div class="ant-input">`），内部 `<input>` 元素不受影响
- **Button**：`style` prop 传递到 `<button>` 元素，但 Ant Design 内部通过 token 系统计算的 `fontSize` 由 cssinjs 注入，会覆盖内联 `style`

---

## 根因分析

Ant Design 5 的 `size="small"` 组件字号由设计 token 控制：

| 组件 | 相关 Token | 默认值 |
|------|-----------|--------|
| Input | `fontSizeSM` | 14px |
| Button | `fontSizeSM` + `contentFontSizeSM` | 14px |

这些 token 通过 cssinjs 运行时计算并注入 `<style>` 标签，普通 CSS（包括 CSS Modules、内联 style）的优先级都低于 cssinjs 的计算样式。

---

## 可行的替代方案（待尝试）

### 方案 A：ConfigProvider 全局 token（影响范围大）

```tsx
<ConfigProvider
  theme={{
    token: { fontSizeSM: 12 },
  }}
>
  <App />
</ConfigProvider>
```

**风险**：会影响全站所有 `size="small"` 组件，包括导航、表单、表格等。

### 方案 B：ConfigProvider 组件级 token（推荐）

```tsx
<ConfigProvider
  theme={{
    components: {
      Input: { fontSizeSM: 12 },
      Button: { contentFontSizeSM: 12 },
    },
  }}
>
  {/* 仅包裹需要覆写的区域 */}
</ConfigProvider>
```

**优点**：仅影响包裹范围内的组件，不影响全局。

### 方案 C：完全自定义（不用 size="small"）

不用 Ant Design 内置的 `size="small"`，直接通过 style/className 自定义所有样式（边框、内边距、字号、行高），完全绕过 token 系统。

**风险**：需要手动匹配组件的所有尺寸属性，维护成本高。

---

## 涉及文件

| 文件 | 说明 |
|------|------|
| `pages/topology/TopologyManagement.tsx:578` | Input `节点文字` |
| `pages/topology/TopologyManagement.tsx:580` | Button `添加到画布` |

---

## 备注

- 此问题本质是 Ant Design 5 cssinjs 的样式隔离机制导致的，Ant Design 4（使用 Less/CSS）不存在此问题
- 方案 B（ConfigProvider 组件级 token）是最干净的方案，待后续执行
