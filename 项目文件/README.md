# 一站式工作台 (Unified Workbench)

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

---

## 快速启动（一步启动）

### 前置条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 已安装并运行
- Windows 10/11 或 macOS 10.15+

### 启动

| 系统 | 命令 | 说明 |
|------|------|------|
| macOS / Linux | `bash start.sh` | 自动检测本机 IP，输出局域网访问地址 |
| Windows | `start.bat` | 自动检测本机 IP，输出局域网访问地址 |

脚本会自动：
1. 检测本机局域网 IP（用于 WebRTC 推流和局域网访问）
2. 检查 Docker 运行状态
3. 自动创建 .env（首次启动，从 .env.example 复制）
4. 构建并启动所有服务

### 访问

| 地址 | 说明 |
|------|------|
| `http://localhost` | 本机 HTTP |
| `https://localhost` | 本机 HTTPS（自签名证书，浏览器需信任） |
| `http://<你的IP>` | 局域网 HTTP |
| `https://<你的IP>` | 局域网 HTTPS |
| `http://localhost/api/v1/docs` | API 文档 |

### 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123456 |

首次登录后建议立即修改密码。

### 停止

```bash
docker compose -p unified-workbench down
```

---

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
├── .env.example           # 环境变量模板
├── start.sh               # macOS/Linux 一键启动
└── start.bat              # Windows 一键启动
```

## 开发规范

- 后端：PEP8 + ruff + black + mypy
- 前端：ESLint + Prettier + 严格 TypeScript
- API：RESTful，统一响应 `{ "code": 0, "msg": "", "data": {} }`
- 启动脚本：所有服务启停必须使用 `start.sh` / `start.bat`，不得手动运行 `docker compose` 命令

## 安全约束

- 密码：bcrypt 哈希，≥8 位含字母+数字
- 密钥：AES-256-GCM 加密存储，强制私有
- 会话：JWT + 刷新机制 + 闲置超时登出
- 传输：全站 HTTPS
- 审计日志：只增不改不删
