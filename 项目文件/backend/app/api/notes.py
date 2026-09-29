"""笔记 API 路由"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.schemas.note import NoteCreate, NoteListResponse, NoteResponse, NoteUpdate
from app.schemas.note_draft import DraftResponse, DraftSave
from app.schemas.note_folder import (
    NoteFolderBrief,
    NoteFolderCreate,
    NoteFolderListResponse,
    NoteFolderResponse,
    NoteFolderSetRequest,
    NoteFolderUpdate,
)
from app.schemas.note_link import BacklinkItem, GraphData, TagCount
from app.services.note import (
    create_note,
    delete_note,
    get_note,
    list_all_notes,
    list_notes,
    list_tag_counts,
    update_note,
)
from app.services.note_folder import (
    create_folder,
    delete_folder,
    get_folder,
    list_folder_note_counts,
    list_folders,
    list_note_folders,
    set_note_folders,
    update_folder,
)
from app.services.note_draft import delete_draft, get_draft, upsert_draft
from app.services.note_link import get_backlinks, get_graph

router = APIRouter()


@router.get("/", response_model=UnifiedResponse[NoteListResponse])
async def list_notes_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    tag: str | None = Query(None),
    folder_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notes, total = await list_notes(
        db, current_user.id, page, page_size, search, tag, folder_id
    )
    return UnifiedResponse(
        data=NoteListResponse(
            items=[NoteResponse.model_validate(n) for n in notes], total=total
        )
    )


@router.get("/all", response_model=UnifiedResponse[NoteListResponse])
async def list_all_notes_endpoint(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    notes = await list_all_notes(db, current_user.id)
    return UnifiedResponse(
        data=NoteListResponse(
            items=[NoteResponse.model_validate(n) for n in notes], total=len(notes)
        )
    )


def _folder_response(folder, note_count: int):
    """构造文件夹响应。

    note_count 由调用方聚合后传入，避免在响应模型里承载聚合逻辑。
    """
    return NoteFolderResponse(
        id=folder.id,
        name=folder.name,
        description=folder.description,
        sort_order=folder.sort_order,
        owner_id=folder.owner_id,
        visibility=folder.visibility,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
        note_count=note_count,
    )


# ── 文件夹 ────────────────────────────────────────────────────────────
# 注意：以下字面量路径必须声明在 "/{note_id}" 之前，否则会被路径参数吞掉。


@router.get("/folders", response_model=UnifiedResponse[NoteFolderListResponse])
async def list_folders_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """当前用户可见的文件夹列表，附带可见笔记数。"""
    folders = await list_folders(db, current_user.id)
    counts = await list_folder_note_counts(db, current_user.id)
    items = [
        _folder_response(folder, counts.get(folder.id, 0)) for folder in folders
    ]
    return UnifiedResponse(
        data=NoteFolderListResponse(items=items, total=len(items))
    )


@router.post("/folders", response_model=UnifiedResponse[NoteFolderResponse])
async def create_folder_endpoint(
    request: NoteFolderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """新建文件夹。"""
    folder = await create_folder(db, current_user.id, request)
    return UnifiedResponse(data=_folder_response(folder, 0))


@router.patch("/folders/{folder_id}", response_model=UnifiedResponse[NoteFolderResponse])
async def update_folder_endpoint(
    folder_id: uuid.UUID,
    request: NoteFolderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """改名 / 改简介 / 改显示顺序。"""
    folder = await update_folder(db, folder_id, current_user.id, request)
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    counts = await list_folder_note_counts(db, current_user.id)
    return UnifiedResponse(data=_folder_response(folder, counts.get(folder_id, 0)))


@router.delete("/folders/{folder_id}", response_model=UnifiedResponse[None])
async def delete_folder_endpoint(
    folder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除文件夹；关联记录清除，笔记本身保留。"""
    if not await delete_folder(db, folder_id, current_user.id):
        raise HTTPException(status_code=404, detail="文件夹不存在")
    return UnifiedResponse(msg="文件夹已删除")


@router.post("/", response_model=UnifiedResponse[NoteResponse])
async def create_note_endpoint(
    request: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await create_note(db, current_user.id, request)
    return UnifiedResponse(data=NoteResponse.model_validate(note))


# ── 标签聚合 / 图谱 / 草稿 ─────────────────────────────────────────────
# 注意：以下字面量路径必须声明在 "/{note_id}" 之前，否则会被路径参数吞掉。


@router.get("/tags", response_model=UnifiedResponse[list[TagCount]])
async def list_tags_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """标签使用次数聚合，仅统计当前用户可见的笔记。"""
    counts = await list_tag_counts(db, current_user.id)
    return UnifiedResponse(
        data=[TagCount(tag=tag, count=count) for tag, count in counts]
    )


@router.get("/graph", response_model=UnifiedResponse[GraphData])
async def global_graph_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """全局知识图谱：可见笔记为节点，note_link 为边。"""
    data = await get_graph(db, current_user.id)
    return UnifiedResponse(data=GraphData(**data))


@router.get("/draft", response_model=UnifiedResponse[DraftResponse])
async def get_draft_endpoint(
    note_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """读取本人草稿；note_id 为空表示尚未关联笔记的新笔记草稿。"""
    draft = await get_draft(db, current_user.id, note_id)
    if not draft:
        return UnifiedResponse(data=None, msg="无草稿")
    return UnifiedResponse(data=DraftResponse.model_validate(draft))


@router.put("/draft", response_model=UnifiedResponse[DraftResponse])
async def save_draft_endpoint(
    request: DraftSave,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """保存或覆盖本人草稿。"""
    draft = await upsert_draft(
        db, current_user.id, request.note_id, request.title, request.body
    )
    return UnifiedResponse(data=DraftResponse.model_validate(draft))


@router.delete("/draft", response_model=UnifiedResponse[None])
async def delete_draft_endpoint(
    note_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除本人草稿。"""
    if not await delete_draft(db, current_user.id, note_id):
        return UnifiedResponse(data=None, msg="无草稿")
    return UnifiedResponse(msg="草稿已删除")


@router.get("/{note_id}/backlinks", response_model=UnifiedResponse[list[BacklinkItem]])
async def backlinks_endpoint(
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """反向链接：正文 wikilink 指向该笔记的可见笔记列表。"""
    if not await get_note(db, note_id, current_user.id):
        raise HTTPException(status_code=404, detail="笔记不存在")
    items = await get_backlinks(db, note_id, current_user.id)
    return UnifiedResponse(data=[BacklinkItem(**item) for item in items])


@router.get("/{note_id}/graph", response_model=UnifiedResponse[GraphData])
async def local_graph_endpoint(
    note_id: uuid.UUID,
    depth: int = Query(1, ge=1, le=2),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """局部知识图谱：以该笔记为根做双向 N 跳遍历（1-2 跳）。"""
    if not await get_note(db, note_id, current_user.id):
        raise HTTPException(status_code=404, detail="笔记不存在")
    data = await get_graph(db, current_user.id, root_id=note_id, depth=depth)
    return UnifiedResponse(data=GraphData(**data))


@router.get("/{note_id}", response_model=UnifiedResponse[NoteResponse])
async def get_note_endpoint(
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await get_note(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return UnifiedResponse(data=NoteResponse.model_validate(note))


@router.put("/{note_id}", response_model=UnifiedResponse[NoteResponse])
async def update_note_endpoint(
    note_id: uuid.UUID,
    request: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await update_note(db, note_id, current_user.id, request)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return UnifiedResponse(data=NoteResponse.model_validate(note))


@router.get(
    "/{note_id}/folders", response_model=UnifiedResponse[list[NoteFolderBrief]]
)
async def list_note_folders_endpoint(
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询某笔记所属的可见文件夹。"""
    if not await get_note(db, note_id, current_user.id):
        raise HTTPException(status_code=404, detail="笔记不存在")
    folders = await list_note_folders(db, note_id, current_user.id)
    return UnifiedResponse(
        data=[NoteFolderBrief.model_validate(f) for f in folders]
    )


@router.put("/{note_id}/folders", response_model=UnifiedResponse[NoteResponse])
async def set_note_folders_endpoint(
    note_id: uuid.UUID,
    request: NoteFolderSetRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """全量替换笔记的文件夹归属；传空列表表示移出全部文件夹。"""
    note = await set_note_folders(db, note_id, current_user.id, request.folder_ids)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return UnifiedResponse(data=NoteResponse.model_validate(note))


@router.delete("/{note_id}", response_model=UnifiedResponse[None])
async def delete_note_endpoint(
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await delete_note(db, note_id, current_user.id):
        raise HTTPException(status_code=404, detail="笔记不存在")
    return UnifiedResponse(msg="笔记已删除")
