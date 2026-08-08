"""数据导出 API 路由

POST   /data/export                      — 启动导出（需管理员 + 密码短语）
GET    /data/export/{export_id}/status   — 查询导出进度
GET    /data/export/{export_id}/download — 下载加密 ZIP 文件
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.schemas.common import UnifiedResponse
from app.services import data_export

router = APIRouter()


@router.post("/export", response_model=UnifiedResponse[dict])
async def start_export_endpoint(
    password: str = Form(..., description="管理员密码短语，用于派生 AES 加密密钥"),
    _current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """启动全量数据导出。

    服务端使用 PBKDF2(passphrase + pepper, random_salt, 600k iter) 派生 AES-256 密钥，
    生成加密 ZIP。密码短语仅用于本次导出，不持久化存储。
    """
    export_id = await data_export.start_export(db, password)
    return UnifiedResponse(data={"export_id": export_id})


@router.get("/export/{export_id}/status", response_model=UnifiedResponse[dict])
async def get_export_status_endpoint(
    export_id: str,
    _current_user=Depends(require_admin),
):
    """查询导出任务状态。"""
    status = data_export.get_export_status(export_id)
    if status is None:
        raise HTTPException(status_code=404, detail="导出任务不存在")
    return UnifiedResponse(data=status)


@router.get("/export/{export_id}/download", response_model=None)
async def download_export_endpoint(
    export_id: str,
    _current_user=Depends(require_admin),
):
    """下载加密 ZIP 文件。

    响应头 ``X-Export-Salt`` 携带十六进制 salt 值，用于客户端解密。
    """
    result = data_export.get_export_path(export_id)
    if result is None:
        status = data_export.get_export_status(export_id)
        if status is None:
            raise HTTPException(status_code=404, detail="导出任务不存在")
        if status["status"] == "running":
            raise HTTPException(status_code=400, detail="导出尚未完成")
        if status["status"] == "failed":
            raise HTTPException(
                status_code=500,
                detail=f"导出失败: {status.get('error', '未知错误')}",
            )
        raise HTTPException(status_code=500, detail="导出状态异常")

    zip_path, salt_hex = result
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="导出文件已失效，请重新导出")

    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename=f"export_{export_id}.zip",
        headers={"X-Export-Salt": salt_hex},
    )
