# 统一工作台 (Unified Workbench)

面向 20 人小团队的内网一体化协作与信息管理平台。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.11+ / FastAPI / SQLAlchemy 2.0 / Alembic |
| 前端 | React 18 / TypeScript 5 / Ant Design 5 / Tiptap |
| 数据库 | PostgreSQL 15+ |
| 缓存/队列 | Redis 7 / Celery |
| 实时推送 | WebSocket |
| 部署 | Docker Desktop + Docker Compose |

## 快速启动

### 前置条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 已安装并运行
- Windows 10/11 或 macOS

### 启动步骤

1. 复制环境配置文件：

   ```bash
   copy .env.example .env
   ```

2. （可选）编辑 `.env` 文件，配置数据库密码、存储路径等。

3. 一键启动所有服务：

   ```bash
   start.bat
   ```

   或手动执行：

   ```bash
   docker compose up -d --build
   ```

4. 访问系统：
   - 前端界面：http://localhost
   - 后端 API：http://localhost/api/v1
   - API 文档：http://localhost/api/v1/docs

## 目录结构

```
.
├── backend/                # 后端 FastAPI 项目
│   ├── app/
│   │   ├── api/           # 路由
│   │   ├── core/          # 配置、安全、依赖
│   │   ├── models/        # 数据库模型
│   │   ├── schemas/       # Pydantic 模型
│   │   ├── services/      # 业务逻辑
│   │   ├── tasks/         # Celery 任务
│   │   └── utils/         # 工具
│   ├── alembic/           # 数据库迁移
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/              # 前端 React 项目
│   ├── src/
│   │   ├── layouts/       # 布局组件
│   │   ├── pages/         # 页面组件
│   │   ├── router.tsx     # 路由配置
│   │   └── main.tsx       # 入口
│   ├── package.json
│   └── Dockerfile
├── nginx/                 # Nginx 反向代理配置
├── docker-compose.yml
├── .env.example
└── start.bat              # Windows 一键启动脚本
```

## 开发规范

- 后端：PEP8 + ruff + black + mypy
- 前端：ESLint + Prettier + 严格 TypeScript
- API：RESTful，统一响应 `{ "code": 0, "msg": "", "data": {} }`

## 安全约束

- 密码：bcrypt 哈希，≥8 位含字母+数字
- 密钥：AES-256-GCM 加密存储，强制私有
- 会话：JWT + 刷新机制 + 闲置超时登出
- 传输：全站 HTTPS
- 审计日志：只增不改不删
