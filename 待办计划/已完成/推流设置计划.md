# 推流设置功能计划

## 需求描述

1. 新增推流设置，包括码率、分辨率、帧率等配置
2. 默认服务器地址/端口配置
3. 支持多用户推流直播（每个用户有独立的推流密钥）

## 修改文件

### 后端
- `backend/app/api/stream.py` — 新建，推流配置 API
- `backend/app/services/stream.py` — 新建，推流配置服务

### 前端
- `frontend/src/pages/streaming/StreamSettings.tsx` — 新建，推流设置页面
- `frontend/src/pages/streaming/StreamSettings.module.css` — 新建，样式
- `frontend/src/api/stream.ts` — 新建，推流 API 调用
- `frontend/src/router.tsx` — 修改，添加路由
- `frontend/src/layouts/MainLayout.tsx` — 修改，添加菜单项

## 具体修改步骤

### 1. 创建后端推流配置服务

`backend/app/services/stream.py`：

```python
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.system_config import get_config, update_config

DEFAULT_STREAM_CONFIG = {
    "server_url": "rtmp://localhost:1935/live",
    "server_port": 1935,
    "default_bitrate": 2500,
    "default_resolution": "1920x1080",
    "default_fps": 30,
    "max_bitrate": 10000,
    "min_bitrate": 500,
    "enable_auth": True,
}

async def get_stream_config(db: AsyncSession) -> dict:
    """获取推流配置"""
    config = await get_config(db, "stream_config")
    if config and isinstance(config, dict):
        return {**DEFAULT_STREAM_CONFIG, **config}
    return DEFAULT_STREAM_CONFIG

async def update_stream_config(db: AsyncSession, updates: dict) -> dict:
    """更新推流配置"""
    current = await get_stream_config(db)
    updated = {**current, **updates}
    await update_config(db, "stream_config", updated)
    return updated

async def get_user_stream_key(db: AsyncSession, user_id: int) -> str:
    """获取用户的推流密钥，不存在则自动生成"""
    keys = await get_config(db, "stream_keys")
    if not keys or not isinstance(keys, dict):
        keys = {}
    
    user_key = keys.get(str(user_id))
    if not user_key:
        user_key = str(uuid.uuid4())
        keys[str(user_id)] = user_key
        await update_config(db, "stream_keys", keys)
    
    return user_key

async def reset_user_stream_key(db: AsyncSession, user_id: int) -> str:
    """重置用户的推流密钥"""
    keys = await get_config(db, "stream_keys")
    if not keys or not isinstance(keys, dict):
        keys = {}
    
    new_key = str(uuid.uuid4())
    keys[str(user_id)] = new_key
    await update_config(db, "stream_keys", keys)
    return new_key
```

### 2. 创建后端推流配置 API

`backend/app/api/stream.py`：

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.stream import (
    get_stream_config,
    update_stream_config,
    get_user_stream_key,
    reset_user_stream_key,
)

router = APIRouter(prefix="/stream", tags=["stream"])

class StreamConfigUpdate(BaseModel):
    server_url: str | None = None
    server_port: int | None = None
    default_bitrate: int | None = None
    default_resolution: str | None = None
    default_fps: int | None = None
    max_bitrate: int | None = None
    min_bitrate: int | None = None
    enable_auth: bool | None = None

@router.get("/config")
async def api_get_stream_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = await get_stream_config(db)
    return {"code": 0, "msg": "", "data": config}

@router.put("/config")
async def api_update_stream_config(
    updates: StreamConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = await update_stream_config(db, updates.model_dump(exclude_none=True))
    return {"code": 0, "msg": "推流配置已更新", "data": config}

@router.get("/key")
async def api_get_stream_key(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = await get_user_stream_key(db, current_user.id)
    config = await get_stream_config(db)
    return {
        "code": 0, "msg": "",
        "data": {
            "stream_key": key,
            "push_url": f"{config['server_url']}/{key}",
        },
    }

@router.post("/key/reset")
async def api_reset_stream_key(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_key = await reset_user_stream_key(db, current_user.id)
    config = await get_stream_config(db)
    return {
        "code": 0, "msg": "推流密钥已重置",
        "data": {
            "stream_key": new_key,
            "push_url": f"{config['server_url']}/{new_key}",
        },
    }
```

### 3. 注册路由

在 `backend/app/api/router.py` 中添加：
```python
from app.api.stream import router as stream_router
app.include_router(stream_router, prefix="/api/v1")
```

### 4. 创建前端 API

`frontend/src/api/stream.ts`：

```typescript
import { request } from '../utils/request';

export interface StreamConfig {
  server_url: string;
  server_port: number;
  default_bitrate: number;
  default_resolution: string;
  default_fps: number;
  max_bitrate: number;
  min_bitrate: number;
  enable_auth: boolean;
}

export interface StreamKey {
  stream_key: string;
  push_url: string;
}

export async function getStreamConfig() {
  return request<StreamConfig>('/stream/config');
}

export async function updateStreamConfig(config: Partial<StreamConfig>) {
  return request<StreamConfig>('/stream/config', { method: 'PUT', body: config });
}

export async function getStreamKey() {
  return request<StreamKey>('/stream/key');
}

export async function resetStreamKey() {
  return request<StreamKey>('/stream/key/reset', { method: 'POST' });
}
```

### 5. 创建推流设置页面

`frontend/src/pages/streaming/StreamSettings.tsx`：

功能：
- 服务器地址/端口配置
- 码率配置（默认、最小、最大）
- 分辨率选择
- 帧率选择
- 推流密钥显示/重置
- 推流地址显示

### 6. 添加路由和菜单

在 router.tsx 添加路由，在 MainLayout.tsx 添加菜单项。

## 验证清单

1. 推流设置页面可访问
2. 可以配置服务器地址/端口
3. 可以配置码率/分辨率/帧率
4. 每个用户有独立的推流密钥
5. 可以重置推流密钥
6. 推流地址正确显示
7. 前端构建通过
8. 后端健康检查返回 200
