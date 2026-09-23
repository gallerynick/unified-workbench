## [日志编号 121] - 2026-09-09 19:40

### 开发版本
版本号：v2.0.0

### 关联基定
- 《开发基准文档》第 4 章 安全约束（依赖安全）
- 《开发基准文档》数据库迁移规范
- 《容器化部署》后端启动链路

### 开发目标
1. 升级 react-router-dom 到 7.18.3，清掉生产依赖树的 2 个 moderate 漏洞（GHSA-wrjc-x8rr-h8h6 / GHSA-337j-9hxr-rhxg）
2. 数据库物理列 allow_anonymous 改名为 allow_visitor，与代码层命名口径彻底对齐
3. 在动手前先落地一个可全量回退的还原点
4. 删除 FormResponses 空态的一条多余提示文案

### 涉及模块 / 文件
- 模块：前端路由依赖、表单收集（数据库列名）、后端启动链路、表单统计页
- 新增文件：
  - 项目文件/backend/app/startup_migrate.py
  - 项目文件/backend/alembic/versions/046_rename_form_allow_visitor.py
- 修改文件：
  - 项目文件/backend/Dockerfile
  - 项目文件/backend/app/models/form.py
  - 项目文件/frontend/package.json
  - 项目文件/frontend/package-lock.json
  - 项目文件/frontend/src/pages/forms/FormResponses.tsx
- 删除文件：无

### 开发内容详述

**0. 先建还原点（所有变更前）**

- 位置：/Users/gallerynick/Documents/Project/还原点_20260909_185708/
- 内容：代码快照 tar.gz（9.2MB，含 .git 与 .env，排除 node_modules / .venv / dist / __pycache__ / .ruff_cache）、pg_dump 全量导出（129KB，42 张表，带 --clean --if-exists）、5 个镜像打 restore-20260909_185708 标签、环境快照（服务清单 + .env 键名 + 前后端关键依赖版本）、SHA256SUMS、回退手册.md
- 实测可回退：校验和 OK；解包后与工作区逐文件比对无缺失，6 个关键文件逐字节一致；数据库 dump 真恢复到临时库 rp_verify，0 错误、表数 42/42、行数一致，临时库已清理；5 个 restore-* 镜像标签均已存在
- 回退方式：按 回退手册.md 逐段执行（停服务 → 恢复数据库 → 解包覆盖代码 → npm ci → start.sh），手册里另有只回退数据库 / 只回退代码 / 只回退镜像三种部分回退方案

**1. react-router-dom 6.30.4 升到 7.18.3**

- package.json 由 ^6.28.0 改为 ^7.18.3，npm install 后实际安装 7.18.3。v7 的 react-router-dom 是薄包装（依赖 react-router@7.18.3），import 路径不变，业务代码一行未改
- 影响范围是全站而非表单模块：react-router-dom 是根 package.json 的单一直依赖，全应用共用同一个 createBrowserRouter 实例，46 个源文件从该包导入
- 兼容性实测：全站 46 处 import，去重后 8 个符号（Navigate / Outlet / RouterProvider / createBrowserRouter / useLocation / useNavigate / useParams / useRouteError），逐个对照 v7.18.3 实际导出，8/8 命中且全部为函数，0 缺失，运行时不会出现 undefined 导入
- 一个额外发现：全站没有从 react-router-dom 导入 Link。此前判断的「2 处 Link 标签」实际是 antd 的 Typography.Link，所以这条开放重定向 advisory 的可达面比原先估计的更小

**2. 物理列改名 allow_anonymous 改为 allow_visitor**

- 迁移：新增 046_rename_form_allow_visitor.py，upgrade 用 op.alter_column(..., new_column_name=) 改名，downgrade 反向改回。离线校验双向 SQL 正确（顺带发现 alembic 没有 op.rename_column，只有 alter_column 的 new_column_name 参数）
- 模型：app/models/form.py 去掉 mapped_column 的显式列名参数，物理列与属性名统一为 allow_visitor；上一轮加的 allow_visitor 收敛逻辑（仅公开可见性生效）不受影响
- 改名安全性：该列上无索引、无约束（form 表只有 form_pkey 落在 id 上），纯改名不丢数据

**3. 部署链路：抽出 app/startup_migrate.py**

- 原 backend/Dockerfile 的 CMD 是一行 778 字符的 python -c 内联脚本，只做了 create_all 加两个 meeting_id 的 ADD COLUMN；幂等的列改名分支塞不进去
- 抽出为 app/startup_migrate.py：create_all → 迁移 043 的两个 meeting_id（ADD COLUMN IF NOT EXISTS）→ 迁移 046 的列改名（按当前列状态三分支：只有旧列则 RENAME；两列并存则先 UPDATE 同步再 DROP 旧列；都不存在则跳过）
- CMD 简化为 python app/startup_migrate.py 然后 uvicorn
- 为什么必须这么做：线上库由 create_all 首次建表，没有 alembic_version 表，alembic upgrade head 不会自动执行；app/db_migrate.py 里那套「stamp head 加 upgrade head」从未被任何 Dockerfile / compose / 脚本调用，是死代码。所以增量结构变更必须走 startup_migrate.py 的幂等 SQL，并与 alembic/versions 下的迁移保持同等变更
- 幂等性实测：容器内连跑两次，第一次完成改名，第二次无任何变更且无报错；部署后 backend 启动日志第一行是 [startup_migrate] 建表与增量迁移完成

**4. FormResponses 空态提示删除**

- 删除 totalResponses 为 0 时 Alert 的 description（「以下图表与明细以 0 值展示，收到回复后会自动更新。」），保留 message「暂无回复」，Alert 压成单行

### 验证
- 后端 ruff（startup_migrate.py / models/form.py / services/form.py / api/forms.py / schemas/form.py / 046 迁移）：All checks passed
- 后端 mypy（改动文件口径）：71 errors / 31 files，与改动前基线完全一致；startup_migrate.py 零报错
- 前端 tsc --noEmit（tsconfig.app.json）：0 错误，升级后无需改任何一行代码
- 前端 eslint（本轮触及的 5 个文件）：0 errors，2 个 react-refresh 警告为历史遗留
- 前端 build：通过，4.48s
- npm audit --omit=dev：**0 vulnerabilities**（生产依赖树清零）；npm audit 全量剩 6 个（1 moderate 5 high）全部在 devDependencies，不进产物
- 部署：首次部署 backend 崩溃重启循环，原因是新建文件权限为 0600，进镜像后 root:root 0600 导致非 root 的 workbench 用户读不到 startup_migrate.py；chmod 644 后重新部署，8 容器 healthy，/api/v1/health 200
- 数据库：form.allow_visitor boolean NOT NULL 就位；存量表单 1 行数据保留，allow_visitor=f
- 门禁四形态回归实测（临时表单，测完即删，残留 0）：
  - public + allow_visitor=false -> GET 401 / POST 401
  - public + allow_visitor=true -> GET 200 / POST 200，respondent_id IS NULL = true
  - restricted + allow_visitor=true -> GET 404 / POST 404
  - restricted + allow_visitor=false -> GET 404 / POST 404
- OpenAPI：allow_visitor 5 次、visitor_count 1 次、allow_anonymous 0 次、anonymous_count 0 次、forms 路由 8 条
- 全站路由回归：27 个路由全部返回 200 且带 id="root"；dist 下 135 个 JS / CSS 全部可访问

### 遗留问题
- eslint 全量仍有 6 个 no-explicit-any error，集中在 src/api/security.ts 与 src/api/stream.ts，本轮未改动这两个文件，属历史遗留
- mypy 全量 609 errors / 141 files（改动文件口径 71/31），历史基线未变动
- devDependencies 的 6 个漏洞（1 moderate 5 high）未处理：不影响生产产物，如要清需单独处理 dev 依赖
- 还原点 /Users/gallerynick/Documents/Project/还原点_20260909_185708/ 及 5 个 restore-* 镜像标签，请在确认无需回退后按 回退手册.md 末尾的清理段执行
- 120 号日志记录的 react-router 遗留问题本轮已解决
