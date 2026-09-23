# 懒加载 chunk 失效（Failed to fetch dynamically imported module）

## 问题分类
前端构建 / 懒加载 / 部署

## 触发场景
长时间不操作（标签页闲置数分钟至数小时）后回到工作台，点击其他模块或执行操作，
页面弹出 "Unexpected Application Error!"，并显示：

    TypeError: Failed to fetch dynamically imported module:
      https://localhost/assets/NotificationsCenter-<hash>.js

刷新后恢复正常。已加载过的模块不受影响，只有尚未加载的模块会触发。

## 根因
Vite 构建产物按内容哈希命名（如 NotificationsCenter-B4lLEQcw.js）。
项目每次部署都重新构建前端镜像（start.sh 走 docker compose up -d --build），
新构建生成全新哈希，**旧哈希的 chunk 文件在容器里已不存在**。

关键链路：

1. 用户开着标签页不操作 → 期间发生了重新部署
2. 标签页内存中仍是部署前的 entry bundle，其中懒加载路由表记录的仍是旧哈希
3. 回来后点击一个**尚未加载过**的模块 → React.lazy 触发 import() 请求旧哈希 chunk
4. Nginx 返回 404 → 浏览器抛出 TypeError: Failed to fetch dynamically imported module
5. 该异常冒泡到 React Router 的路由级错误边界 → 渲染内置的
   "Unexpected Application Error!" 页面（无操作入口、不可恢复）
6. 刷新 → 浏览器重新拉取 index.html（nginx 中为 no-store）→ 拿到新 manifest → 恢复

已加载过的模块不受影响，因为其代码已在内存中，不会再次发起请求。这就是
"点其他模块才崩"的现象来源。

补充：nginx 对 JS 设的是 expires 1y + immutable，这**不是**根因——
问题是文件在服务端已不存在（404），而非客户端缓存了过期内容。

## 修复方案
新增 src/utils/chunkGuard.ts，两层保护：

### 1. 主动探测（startBuildWatcher）
index.html 在 nginx 中是 no-store，每次请求都拿到最新 manifest，
而 manifest 里 entry 脚本名带内容哈希——哈希变了即说明前端已重新部署。

- 每 60 秒轮询一次，另在 visibilitychange（标签页恢复可见）与 window focus 时立即检查
- 只置内存标记 newBuildDetected，**不主动刷新**（不打断用户）
- 由下一次懒加载真正发生时消费标记 → 整页刷新
- 开发模式（无哈希产物）自动跳过，零副作用

### 2. 被动兜底（lazyChunk）
用法与 React.lazy 完全一致，router.tsx 只需把 React.lazy 替换为 lazyChunk，
47 处懒加载路由零改动获得保护：

    const lazy = lazyChunk;   // router.tsx 中一行别名替换

- import() 真正失败且错误信息匹配 chunk 失效特征时，自动 reload 一次
- sessionStorage 记录刷新时间戳，2 分钟保护窗口内不重复刷新，
  防止「刷新后仍失败 → 再刷新」的无限循环
- sessionStorage 不可用（隐私模式等）时放弃自动刷新，把异常交给错误页，不进入死循环

### 3. 全局错误边界（src/components/ErrorBoundary.tsx）
替换 React Router 内置的 "Unexpected Application Error!" 页面：

- 用 antd Result 渲染，带「重新加载页面」按钮，可操作可恢复
- 继承 ConfigProvider 的深浅色模式，符合项目 UI 规范
- 区分 chunk 失效与业务异常，给出不同文案
- 承接两类错误：chunk 失效且自动刷新未恢复；路由守卫、Provider、布局等非路由组件抛出的未捕获异常

## 易错点
- **不要**为了让旧 chunk 可用而保留多版本构建产物——那会让线上长期堆积废弃 JS，
  且无法解决 CSS preload 的同类问题。正确做法是让页面自己感知并刷新。
- **不要**在探测到新部署时立即强制刷新：用户可能正在输入，会丢数据。
  应在真正需要加载新 chunk 的瞬间刷新——那时旧页面本来就要崩，无数据可丢。
- **不要**省略 sessionStorage 保护窗口。若刷新后仍失败（例如部署脚本本身有问题），
  没有窗口就是无限刷新循环，比原来的报错更糟。
- lazyChunk 的兜底必须在 reload 之后返回**永不 resolve 的 Promise**，
  让 React 保持 Suspense 状态等待整页刷新，否则 React 会把 reject 再次抛给错误边界。
- 保护窗口（2 分钟）要大于单次构建+部署耗时，否则刚部署完就回来仍会撞崩溃。
- 判断 chunk 失效要用错误信息特征匹配，不能捕获所有 import 错误——
  业务代码自身的 import 失败（如路径写错）应照常冒泡暴露。
