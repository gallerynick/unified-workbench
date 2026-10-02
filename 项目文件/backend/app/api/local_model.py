"""本地 AI 模型管理 API。

对接 llama.cpp 的 server：模型以 GGUF 文件形式落在共享目录，
llama.cpp 以 router 模式扫描该目录并按名动态载入/卸载。

状态语义（对本工作台是统一的四态）：
- not_downloaded  目录里没有对应 GGUF
- downloaded      有文件但未占用内存（llama.cpp 侧 unloaded / sleeping）
- ready           已载入内存（llama.cpp 侧 loaded）
- downloading     正在拉取（由下载任务提供进度）
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.services import llama_cpp, model_download

router = APIRouter()


class ModelPullRequest(BaseModel):
    """模型下载请求"""

    name: str


class ModelStatusResponse(BaseModel):
    """单个模型的状态"""

    name: str
    downloaded: bool
    size: int | None = None
    modified_at: str | None = None
    # llama.cpp 侧状态：loaded / loading / unloaded / sleeping / downloading
    engine_status: str | None = None


class ModelListResponse(BaseModel):
    """模型列表"""

    models: list[ModelStatusResponse]


class CatalogEntry(BaseModel):
    """可下载模型目录项"""

    name: str
    label: str
    size_mb: float | None = None
    downloaded: bool = False


def _raise_unavailable(exc: Exception) -> None:
    """把引擎侧异常翻译成 HTTP 语义。

    区分「连不上」与「超时」，前端据此给出不同提示——
    llama.cpp 未启动和冷启动慢是两种完全不同的处置。
    """
    import httpx

    if isinstance(exc, httpx.ConnectError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="本地 AI 服务不可用",
        )
    if isinstance(exc, httpx.TimeoutException):
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="本地 AI 服务响应超时",
        )
    if isinstance(exc, httpx.HTTPStatusError):
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"本地 AI 服务返回错误：{exc.response.text[:200]}",
        )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"本地 AI 服务调用失败：{exc}",
    )


@router.get("/models", response_model=UnifiedResponse[ModelListResponse])
async def list_models(
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[ModelListResponse]:
    """列出本地模型。

    以磁盘上的 GGUF 为准（那才是「有没有模型」的事实来源），
    再叠加 llama.cpp 报告的载入状态。
    """
    files = {item["name"]: item for item in llama_cpp.local_model_files()}

    engine_state: dict[str, str] = {}
    try:
        for entry in await llama_cpp.list_models():
            engine_state[str(entry.get("id"))] = llama_cpp.status_value(entry)
    except Exception:
        # 引擎暂时不可达不应让列表接口整体失败：磁盘上的模型仍然要能列出来，
        # 只是状态退化为「未知」，由前端提示。
        engine_state = {}

    models = [
        ModelStatusResponse(
            name=name,
            downloaded=True,
            size=info["size_bytes"],
            engine_status=engine_state.get(name),
        )
        for name, info in sorted(files.items())
    ]
    return UnifiedResponse(data=ModelListResponse(models=models))


@router.get("/catalog", response_model=UnifiedResponse[list[CatalogEntry]])
async def get_catalog(
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[list[CatalogEntry]]:
    """可下载模型目录，附带各模型是否已在本地。"""
    local = {item["name"] for item in llama_cpp.local_model_files()}
    entries = [
        CatalogEntry(
            name=name,
            label=spec["label"],
            downloaded=name in local,
        )
        for name, spec in llama_cpp.MODEL_CATALOG.items()
    ]
    return UnifiedResponse(data=entries)


@router.get("/models/{model_name}/status", response_model=UnifiedResponse[ModelStatusResponse])
async def get_model_status(
    model_name: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[ModelStatusResponse]:
    """查询单个模型状态。"""
    info = next(
        (item for item in llama_cpp.local_model_files() if item["name"] == model_name),
        None,
    )
    if info is None:
        return UnifiedResponse(
            data=ModelStatusResponse(name=model_name, downloaded=False)
        )

    engine_status = None
    try:
        entry = await llama_cpp.find_model(model_name)
        if entry is not None:
            engine_status = llama_cpp.status_value(entry)
    except Exception:
        engine_status = None

    return UnifiedResponse(
        data=ModelStatusResponse(
            name=model_name,
            downloaded=True,
            size=info["size_bytes"],
            engine_status=engine_status,
        )
    )


@router.post("/models/{model_name}/load", response_model=UnifiedResponse[dict[str, Any]])
async def load_model(
    model_name: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """把模型载入内存。冷启动要读盘，耗时可能较长。"""
    if not llama_cpp.model_file_path(model_name).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"模型 {model_name} 未下载",
        )
    try:
        ok = await llama_cpp.load_model(model_name)
    except Exception as exc:
        _raise_unavailable(exc)
    return UnifiedResponse(data={"success": ok, "engine_status": "loaded" if ok else None})


@router.post("/models/{model_name}/unload", response_model=UnifiedResponse[dict[str, Any]])
async def unload_model(
    model_name: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """把模型从内存卸载，归还内存。"""
    try:
        ok = await llama_cpp.unload_model(model_name)
    except Exception as exc:
        _raise_unavailable(exc)
    return UnifiedResponse(data={"success": ok, "engine_status": "unloaded" if ok else None})


@router.delete("/models/{model_name}", response_model=UnifiedResponse[dict[str, Any]])
async def delete_model(
    model_name: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """删除本地模型文件。

    先卸载再删文件：文件被进程占用时直接删会留下「引擎仍持有已释放模型」
    的不一致状态。删除失败一律如实报错，不静默吞掉。
    """
    path = llama_cpp.model_file_path(model_name)
    if not path.exists():
        return UnifiedResponse(data={"deleted": False, "message": "模型不存在"})

    try:
        await llama_cpp.unload_model(model_name)
    except Exception:
        # 未载入或引擎不可达都属正常，不影响删文件
        pass

    try:
        path.unlink()
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除模型文件失败：{exc}",
        )

    try:
        await llama_cpp.reload_models()
    except Exception:
        pass

    return UnifiedResponse(data={"deleted": True, "message": f"已删除 {model_name}"})


@router.get("/health", response_model=UnifiedResponse[dict[str, Any]])
async def health(
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """探测本地 AI 服务。

    llama.cpp 在模型载入中时 /health 返回 503，这里如实区分：
    503 是「载入中」而非「服务挂了」，前端不应报错。
    """
    try:
        result = await llama_cpp.health()
    except Exception as exc:
        _raise_unavailable(exc)

    code = int(result.get("status_code") or 0)
    if code == 200:
        return UnifiedResponse(data={"status": "ok", "reason": None})
    if code == 503:
        message = (result.get("error") or {}).get("message") or "模型载入中"
        return UnifiedResponse(data={"status": "loading", "reason": message})
    return UnifiedResponse(
        data={"status": "error", "reason": f"HTTP {code}"}
    )


# ── 下载任务 ────────────────────────────────────────────────────────


@router.post("/download/start", response_model=UnifiedResponse[dict[str, Any]])
async def start_download(
    request: ModelPullRequest,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """启动模型下载。"""
    task_id = await model_download.start_model_download(request.name, str(current_user.id))
    return UnifiedResponse(data={"task_id": task_id})


@router.get("/download/{task_id}/status", response_model=UnifiedResponse[dict[str, Any]])
async def get_download_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """查询下载进度。"""
    info = await model_download.get_download_status(task_id, str(current_user.id))
    if info:
        return UnifiedResponse(data=info)
    return UnifiedResponse(data={"status": "not_found", "message": "任务不存在"})


@router.post("/download/{task_id}/pause", response_model=UnifiedResponse[dict[str, Any]])
async def pause_download(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """暂停下载。"""
    success = await model_download.pause_download(task_id, str(current_user.id))
    if success:
        return UnifiedResponse(data={"status": "paused"})
    return UnifiedResponse(data={"status": "error", "message": "暂停失败"})


@router.post("/download/{task_id}/resume", response_model=UnifiedResponse[dict[str, Any]])
async def resume_download(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """恢复下载（会带 Range 从断点续传）。"""
    success = await model_download.resume_download(task_id, str(current_user.id))
    if success:
        return UnifiedResponse(data={"status": "resumed"})
    return UnifiedResponse(data={"status": "error", "message": "恢复失败"})


@router.post("/download/{task_id}/cancel", response_model=UnifiedResponse[dict[str, Any]])
async def cancel_download(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """取消下载。"""
    success = await model_download.cancel_download(task_id, str(current_user.id))
    if success:
        return UnifiedResponse(data={"status": "cancelled"})
    return UnifiedResponse(data={"status": "error", "message": "取消失败"})


@router.get("/download/current", response_model=UnifiedResponse[dict[str, Any]])
async def get_current_download(
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """当前用户正在进行的下载任务（如有）。"""
    info = await model_download.get_user_current_download(str(current_user.id))
    if info:
        return UnifiedResponse(data=info)
    return UnifiedResponse(data={"status": "none", "message": "没有正在进行的下载任务"})
