"""文件 API 路由"""

import uuid

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.file import (
    FileListResponse,
    FolderCreateRequest,
    FolderResponse,
)
from app.schemas.file import (
    FileResponse as FileResponseSchema,
)
from app.services.file import (
    create_folder,
    delete_file,
    delete_folder,
    download_file,
    list_files,
    list_folders,
    upload_file,
)

router = APIRouter()


@router.post("/upload", response_model=UnifiedResponse[FileResponseSchema])
async def upload_file_endpoint(
    file: UploadFile = File(...),
    folder_id: uuid.UUID | None = Form(None),
    visibility: str = Form("private"),
    restricted_users: str | None = Form(None),
    restricted_tags: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r_users = restricted_users.split(",") if restricted_users else None
    r_tags = restricted_tags.split(",") if restricted_tags else None
    db_file = await upload_file(
        db, file, current_user, folder_id, visibility, r_users, r_tags
    )
    return UnifiedResponse(data=FileResponseSchema.model_validate(db_file))


@router.get("/", response_model=UnifiedResponse[FileListResponse])
async def list_files_endpoint(
    folder_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    files, total = await list_files(db, current_user, folder_id, page, page_size)
    items = [FileResponseSchema.model_validate(f) for f in files]
    return UnifiedResponse(data=FileListResponse(items=items, total=total))


@router.get("/{file_id}", response_model=UnifiedResponse[FileResponseSchema])
async def get_file_endpoint(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file = await download_file(db, file_id, current_user)
    return UnifiedResponse(data=FileResponseSchema.model_validate(file))


@router.get("/{file_id}/download")
async def download_file_endpoint(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file = await download_file(db, file_id, current_user)
    return FileResponse(
        path=file.stored_path,
        filename=file.name,
        media_type=file.mime_type,
    )


@router.delete("/{file_id}", response_model=UnifiedResponse[None])
async def delete_file_endpoint(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_file(db, file_id, current_user)
    return UnifiedResponse(msg="文件删除成功")


@router.post("/folders", response_model=UnifiedResponse[FolderResponse])
async def create_folder_endpoint(
    request: FolderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await create_folder(db, request.name, current_user, request.parent_id)
    return UnifiedResponse(data=FolderResponse.model_validate(folder))


@router.get("/folders", response_model=UnifiedResponse[list[FolderResponse]])
async def list_folders_endpoint(
    parent_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folders = await list_folders(db, current_user, parent_id)
    items = [FolderResponse.model_validate(f) for f in folders]
    return UnifiedResponse(data=items)


@router.delete("/folders/{folder_id}", response_model=UnifiedResponse[None])
async def delete_folder_endpoint(
    folder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_folder(db, folder_id, current_user)
    return UnifiedResponse(msg="文件夹删除成功")
