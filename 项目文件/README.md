<p align="center">
  <h1 align="center">一站式工作台</h1>
  <p align="center">面向小团队的内网协作与管理平台</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/python-3.11+-blue" alt="Python">
  <img src="https://img.shields.io/badge/react-18-61dafb" alt="React">
  <img src="https://img.shields.io/badge/typescript-5-3178c6" alt="TypeScript">
</p>

---

## 功能模块

| 模块 | 功能 |
|------|------|
| 📋 **内容管理** | 富文本编辑器（Tiptap）、文件/图片管理、文件夹组织 |
| 📁 **项目管理** | 项目立项、进度追踪、文档协作、表单/投票/记录 |
| 📅 **日历** | 日程管理、重复事件、多种视图 |
| 🎥 **直播工作室** | 直播间系统，支持内置推流（WebRTC）和外部推流（OBS/RTMP），场景合成 |
| 🔔 **通知** | WebSocket 实时推送、站内消息 |
| 💰 **财务** | 预算管理、订阅追踪 |
| 📦 **资产** | 物料管理、联系人管理 |
| 📝 **知识库** | 笔记编辑（支持知识图谱）、模板系统 |
| 🗝️ **密钥管理** | AES-256-GCM 加密存储、二次密码验证 |
| ⏰ **提醒** | 定时提醒、Celery 定时任务 |
| ⚙️ **系统设置** | 用户管理、标签系统、站点设置、备份、公告、审计日志 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.11+ · FastAPI · SQLAlchemy 2.0 · Alembic |
| 前端 | React 18 · TypeScript 5 · Ant Design 5 · Tiptap |
| 数据库 | PostgreSQL 15 |
| 缓存/队列 | Redis 7 · Celery |
| 实时推送 | WebSocket |
| 流媒体 | MediaMTX (WebRTC/RTMP/HLS) |
| 部署 | Docker Compose · Nginx |

## 快速开始

### 前置条件

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 已安装并运行
- Windows 10/11 或 macOS 10.15+

### 一键启动

| 平台 | 命令 |
|------|------|
| macOS / Linux | `bash start.sh` |
| Windows | `start.bat` |

脚本会自动检测本机 IP、创建环境配置、构建并启动所有服务。

### 访问

| 地址 | 说明 |
|------|------|
| `http://localhost` | 本机访问 |
| `https://localhost` | HTTPS（自签名证书） |
| `http://<本机IP>` | 局域网访问 |
| `http://localhost/api/v1/docs` | API 文档（Swagger） |

### 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123456` | 管理员 |

> 首次登录后请立即修改密码。

### 停止

```bash
docker compose -p unified-workbench down
```

## 项目结构

```
.
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/            # API 路由
│   │   ├── core/           # 配置、安全、依赖注入
│   │   ├── models/         # SQLAlchemy 模型
│   │   ├── schemas/        # Pydantic 模型
│   │   ├── services/       # 业务逻辑
│   │   └── tasks/          # Celery 任务
│   ├── alembic/            # 数据库迁移
│   └── Dockerfile
├── frontend/               # React 前端
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── components/     # 通用组件
│   │   ├── layouts/        # 布局组件
│   │   └── hooks/          # 自定义 Hooks
│   └── Dockerfile
├── nginx/                  # Nginx 反向代理
├── mediamtx/               # 流媒体服务器配置
├── docker-compose.yml      # 容器编排
├── start.sh                # macOS/Linux 启动脚本
└── start.bat               # Windows 启动脚本
```

## API 规范

- RESTful 设计，统一响应格式：`{ "code": 0, "msg": "", "data": {} }`
- Pydantic 模型自动生成 OpenAPI 文档
- JWT 认证 + 刷新令牌机制

## 安全

- 密码：bcrypt 哈希，≥8 位含字母+数字
- 密钥：AES-256-GCM 加密，强制私有，查看需二次密码验证
- 会话：JWT + 刷新令牌 + 闲置超时自动登出
- 传输：全站 HTTPS
- 审计日志：只增不改不删

## 开发

```bash
# 后端
cd backend
pip install -e .
uvicorn app.main:app --reload

# 前端
cd frontend
npm install
npm run dev
```

## License

MIT
