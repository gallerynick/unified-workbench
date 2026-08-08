"""数据导入 API 路由

POST   /data/import                      — 上传加密 ZIP 并启动导入（需管理员）
GET    /data/import/{import_id}/status   — 查询导入进度
POST   /data/import/preview              — 预览 ZIP 元数据（版本/表信息），不执行导入
"""

from __future__ import annotations

import os
import tempfile

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.schemas.common import UnifiedResponse
from app.services import data_import
from app.services.data_export import get_or_create_pepper
from app.version import __version__

router = APIRouter()


@router.post("/import", response_model=UnifiedResponse[dict])
async def start_import_endpoint(
    password: str = Form(..., description="管理员密码短语，用于派生 AES 解密密钥"),
    salt: str = Form(..., description="十六进制 salt 值（来自导出响应头 X-Export-Salt）"),
    file: UploadFile = File(..., description="加密 ZIP 文件"),
    _current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """启动全量数据导入。

    将上传的加密 ZIP 保存到临时文件后交给导入服务处理。
    服务端使用 PBKDF2(passphrase + pepper, salt, 600k iter) 派生 AES-256 密钥解密。
    密码短语与 salt 仅用于本次导入，不持久化存储。
    """
    # 保存上传的 ZIP 到临时文件
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    try:
        with tmp as f:
            while chunk := await file.read(1024 * 1024):
                f.write(chunk)
        saved_path = tmp.name
        import_id = await data_import.start_import(db, saved_path, password, salt)
    except Exception as e:
        # 清理临时文件后抛出
        if os.path.exists(tmp.name):
            os.remove(tmp.name)
        raise HTTPException(status_code=500, detail=f"启动导入失败: {e}")
    finally:
        await file.close()

    return UnifiedResponse(data={"import_id": import_id})


@router.get("/import/{task_id}/status", response_model=UnifiedResponse[dict])
async def get_import_status_endpoint(
    task_id: str,
):
    """查询导入任务状态。

    无需管理员权限——task_id 为不可猜测的 UUID，本身即为访问凭据。
    """
    status = data_import.get_import_status(task_id)
    if status is None:
        raise HTTPException(status_code=404, detail="导入任务不存在")
    return UnifiedResponse(data=status)


@router.post("/import/preview", response_model=UnifiedResponse[dict])
async def preview_import_endpoint(
    password: str = Form(..., description="导出时使用的密码短语"),
    salt: str = Form(..., description="十六进制 salt 值"),
    file: UploadFile = File(..., description="加密 ZIP 文件"),
    _current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """预览加密 ZIP 的元数据（版本、表数量、导出时间），不执行导入。

    用于导入确认界面展示版本对比信息。
    """
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    try:
        with tmp as f:
            while chunk := await file.read(1024 * 1024):
                f.write(chunk)
    finally:
        await file.close()

    try:
        pepper = await get_or_create_pepper(db)
        salt_bytes = bytes.fromhex(salt)
        manifest = data_import.read_manifest(tmp.name, password, pepper, salt_bytes)
        os.remove(tmp.name)

        zip_version = manifest.get("version", "unknown")
        can_import = not data_import._version_gt(zip_version, __version__)
        version_note = (
            "版本一致，可直接导入" if zip_version == __version__
            else f"将从 {zip_version} 升级至 {__version__}" if can_import
            else f"数据版本 {zip_version} 高于当前版本 {__version__}，无法导入"
        )

        return UnifiedResponse(data={
            "zip_version": zip_version,
            "current_version": __version__,
            "can_import": can_import,
            "version_note": version_note,
            "exported_at": manifest.get("exported_at", "unknown"),
            "total_tables": len(manifest.get("tables", [])),
            "total_rows": manifest.get("total_rows", 0),
            "file_count": manifest.get("file_count", 0),
            "app_id": manifest.get("app_id", "unknown"),
        })
    except ValueError as e:
        if os.path.exists(tmp.name):
            os.remove(tmp.name)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if os.path.exists(tmp.name):
            os.remove(tmp.name)
        raise HTTPException(status_code=500, detail=f"预览失败: {e}")
