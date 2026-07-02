# CSS 动画与 JS 拖拽库冲突（列表项拖拽无动画）

## 问题分类
CSS Animation / react-dnd / dnd-kit

## 触发场景
给拖拽排序的列表添加 CSS 入场动画后，拖拽功能失去平滑过渡动画（列表项直接跳到新位置，无 transition）。

## 根因
CSS `@keyframes` 动画中的 `transform` 属性填充值会**覆盖 JS 拖拽库通过 inline style 设置的 `transform`**。

拖拽库（react-dnd / dnd-kit）使用 inline style 控制元素拖拽位置：
```tsx
const style = {
  transform: CSS.Transform.toString(transform),  // inline style
  transition,
};
```

同时 CSS 动画在完成后通过 `animation-fill-mode` 保持 `transform: translateY(0)`。当 CSS 动画的 `transform` 和 JS 的 inline `transform` 同时存在时，CSS 动画的值会覆盖 inline 值，导致拖拽过渡失效。

```
CSS 动画   → transform: translateY(0)   （fill-mode 保持）
JS inline  → transform: translate3d(50, 30, 0)  （拖拽库设置）
结果       → CSS 动画值胜出，拖拽位置被忽略
```

## 修复方案
**原则：有拖拽的列表，只动画 `opacity`，不动 `transform`。**

```css
/* ❌ 错误——影响拖拽 */
@keyframes fadeIn {
  0%   { opacity: 0; transform: translateY(16px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* ✅ 正确——只动画透明度 */
@keyframes fadeIn {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}

/* fill-mode: both 防止闪烁 */
.draggable-list > * {
  animation: fadeIn 350ms ease-out both;
}
```

## 易错点
- `animation-fill-mode: both` 同时提供 `backwards`（动画前 hidden）和 `forwards`（动画后 visible）——拖拽列表防闪烁最佳选择
- 同样影响所有通过 JS 控制 `transform` 的场景：滚动视差、缩放拖拽、手势交互等
- 动画不要放在拖拽 wrapper 上，可以放在内部子元素上（如 `.widgetBody`）
