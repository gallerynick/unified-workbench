# Welcome 页面反复出现（设置向导无限循环）

## 问题分类
前端 / 认证流程 / 状态管理

## 触发场景
Safari 或 Edge 浏览器首次登录后，Welcome/初始化设置页面反复出现，用户完成设置后刷新又回到 Welcome 页面。

## 根因
五个相互作用的 Bug：

1. **权限 Bug**：`PUT /system-config/setup_complete` 需要 admin 权限。普通用户完成设置后调用 `markComplete()`，后端因为用户不是 admin 返回 403 或 401 → 静默失败 → 前端状态未更新

2. **时序 Bug**：`refreshUser()` 是异步的，但前端可能在用户信息加载完成之前就检查 `setup_complete` 状态，导致误判

3. **缓存 Bug**：某些浏览器（Safari/Edge）对 localStorage/sessionStorage 的处理与 Chrome 不同，`markComplete()` 乐观更新后 token 刷新可能触发状态重置

4. **路由守卫 Bug**：`AuthGuard` 在 `isAuthenticated()` 为 true 但 `setup_complete` 为 false 时反复重定向到 Welcome 页面

5. **竞态条件**：多个 `useEffect` 和异步操作之间的执行顺序不确定，导致状态判断在不同浏览器中以不同顺序执行

## 修复方案
`markComplete()` 先乐观设置本地状态为 `true`，再异步调用后端：
```ts
async function markComplete() {
  localStorage.setItem('setup_complete', 'true');  // 先乐观设置
  try {
    await fetch('/api/v1/auth/setup-complete', { method: 'POST' });
  } catch {
    // 后端失败也不影响用户体验——本地状态已设置
  }
}
```

## 易错点
- 不要等后端确认再更新 UI 状态——乐观更新优先保证用户体验
- 多浏览器测试时注意 Safari/Edge 的 Storage API 行为差异
- 路由守卫层和业务逻辑层的状态判断要解耦
