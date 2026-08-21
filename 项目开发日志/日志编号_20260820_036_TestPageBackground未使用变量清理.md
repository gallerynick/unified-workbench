## 日志编号_20260820_036_TestPageBackground未使用变量清理

### 开发版本
版本号：v1.0.1

### 关联基定
《项目基定/开发基准文档.md》— TypeScript 代码规范（禁止未使用变量）

### 开发目标
- 清理 `TestPageBackground.tsx` 中 3 处未使用变量的 lint 报错
- 删除 `smokeRef`、`blurReducedRef` 及其引用链，确保 `npm run build` 零错误

### 涉及模块 / 文件
- 模块：前端 / 初始化页粒子动画
- 修改文件：`项目文件/frontend/src/pages/dev/TestPageBackground.tsx`
- 删除文件：无
- 新增文件：无

### 开发内容详述
删除了以下未使用代码：
1. `const smokeRef = useRef<HTMLDivElement | null>(null);` — 第 283 行
2. `const blurReducedRef = useRef<boolean>(false);` — 第 299 行
3. render 函数中依赖上述变量的 7 行 blur 控制代码块（第 566-572 行）
4. JSX 中 `<div ref={smokeRef} className={styles.smoke} aria-hidden="true" />` — 第 860 行
5. 连带删除不再使用的常量 `T_BLUR_REDUCE_START` — 第 30 行

CSS 中的 `.smoke` 类保留不动（含 animation + transition）。

### 遇到的问题与解决
- 问题：第一次编辑 render 中的 blur 控制块时，错误地替换为 `if (t >= T_BLUR_REDUCE_START) {` 空块，导致 `render` 函数括号结构被破坏，引发多处 TS 编译错误
- 解决方案：将残留的空 `if` 块连同多余的 `}` 一起删除，恢复正确的函数结构

### 测试情况
- 测试方式：`npm run build`（`tsc -b && vite build`）
- 测试结果：通过，零 TypeScript 错误，Vite 构建成功
- Docker：`docker compose -p unified-workbench build frontend && docker compose up -d frontend` 构建并启动成功

### 与项目基定的一致性确认
☑ 本次开发完全符合《项目基定》要求

### 下一步计划
无，等待下一个任务。

---