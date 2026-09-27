"""Ollama 模型管理 API"""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.common import UnifiedResponse
from app.services import model_download

router = APIRouter()

# Ollama API 地址（从配置中获取）
OLLAMA_BASE_URL = "http://ollama:11434"


class ModelPullRequest(BaseModel):
    """模型拉取请求"""
    name: str


class ModelDeleteRequest(BaseModel):
    """模型删除请求"""
    name: str


class ModelStatusResponse(BaseModel):
    """模型状态响应"""
    name: str
    downloaded: bool
    # Ollama 返回的是字节数（int）。之前声明成 str，一旦模型已下载，
    # 校验就抛 ValidationError 让整个接口 500，「模型未下载」判断因此永远失效
    size: int | None = None
    modified_at: str | None = None


class ModelListResponse(BaseModel):
    """模型列表响应"""
    models: list[ModelStatusResponse]


async def _ollama_request(
    method: str, endpoint: str, data: dict | None = None, timeout: float = 30.0
) -> dict[str, Any]:
    """发送 Ollama API 请求"""
    url = f"{OLLAMA_BASE_URL}{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            if method == "GET":
                response = await client.get(url)
            elif method == "POST":
                response = await client.post(url, json=data)
            elif method == "DELETE":
                response = await client.delete(url, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")

            response.raise_for_status()
            return response.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama 服务不可用",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Ollama 请求超时",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Ollama API 错误: {e.response.text}",
        )


@router.get("/models", response_model=UnifiedResponse[ModelListResponse])
async def list_models(
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[ModelListResponse]:
    """列出已下载的模型"""
    result = await _ollama_request("GET", "/api/tags")

    models = []
    for model in result.get("models", []):
        models.append(
            ModelStatusResponse(
                name=model.get("name", ""),
                downloaded=True,
                size=model.get("size"),
                modified_at=model.get("modified_at"),
            )
        )

    return UnifiedResponse(data=ModelListResponse(models=models))


@router.post("/models/pull", response_model=UnifiedResponse[dict[str, Any]])
async def pull_model(
    request: ModelPullRequest,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """拉取/下载模型"""
    result = await _ollama_request(
        "POST", "/api/pull", {"name": request.name}, timeout=3600.0
    )
    return UnifiedResponse(data=result)


@router.delete("/models/{model_name}", response_model=UnifiedResponse[dict[str, Any]])
async def delete_model(
    model_name: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """删除模型"""
    result = await _ollama_request(
        "DELETE", f"/api/delete?name={model_name}"
    )
    return UnifiedResponse(data=result)


@router.get("/models/{model_name}/status", response_model=UnifiedResponse[ModelStatusResponse])
async def get_model_status(
    model_name: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[ModelStatusResponse]:
    """获取模型状态"""
    result = await _ollama_request("GET", "/api/tags")

    for model in result.get("models", []):
        if model.get("name") == model_name:
            return UnifiedResponse(
                data=ModelStatusResponse(
                    name=model_name,
                    downloaded=True,
                    size=model.get("size"),
                    modified_at=model.get("modified_at"),
                )
            )

    return UnifiedResponse(
        data=ModelStatusResponse(
            name=model_name,
            downloaded=False,
        )
    )


@router.get("/health", response_model=UnifiedResponse[dict[str, Any]])
async def check_health(
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """检查 Ollama 服务健康状态。

    返回具体原因（timeout / unreachable / api_error），让前端能给出可操作的提示，
    而不是笼统一句「容器没启动」——容器明明在跑，真正的原因往往是 ollama
    正忙于其他请求导致 /api/tags 超时。
    """
    try:
        result = await _ollama_request("GET", "/api/tags", timeout=5.0)
        return UnifiedResponse(data={"status": "ok", "model_count": len(result.get("models", []))})
    except HTTPException as e:
        if e.status_code == status.HTTP_408_REQUEST_TIMEOUT:
            reason = "timeout"
            message = "Ollama 响应超时，服务可能正忙于其他请求"
        elif e.status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
            reason = "unreachable"
            message = "无法连接到 Ollama 服务"
        else:
            reason = "api_error"
            message = f"Ollama API 返回错误：{e.detail}"
        return UnifiedResponse(
            data={"status": "error", "reason": reason, "message": message}
        )


@router.post("/download/start", response_model=UnifiedResponse[dict[str, Any]])
async def start_download(
    request: ModelPullRequest,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """启动模型下载"""
    task_id = await model_download.start_model_download(request.name, str(current_user.id))
    return UnifiedResponse(data={"task_id": task_id})


@router.get("/download/{task_id}/status", response_model=UnifiedResponse[dict[str, Any]])
async def get_download_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """获取下载进度"""
    info = await model_download.get_download_status(task_id, str(current_user.id))
    if info:
        return UnifiedResponse(data=info)
    return UnifiedResponse(data={"status": "not_found", "message": "任务不存在"})


@router.post("/download/{task_id}/pause", response_model=UnifiedResponse[dict[str, Any]])
async def pause_download(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """暂停下载"""
    success = await model_download.pause_download(task_id, str(current_user.id))
    if success:
        return UnifiedResponse(data={"status": "paused"})
    return UnifiedResponse(data={"status": "error", "message": "暂停失败"})


@router.post("/download/{task_id}/resume", response_model=UnifiedResponse[dict[str, Any]])
async def resume_download(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """恢复下载"""
    success = await model_download.resume_download(task_id, str(current_user.id))
    if success:
        return UnifiedResponse(data={"status": "resumed"})
    return UnifiedResponse(data={"status": "error", "message": "恢复失败"})


@router.post("/download/{task_id}/cancel", response_model=UnifiedResponse[dict[str, Any]])
async def cancel_download(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """取消下载"""
    success = await model_download.cancel_download(task_id, str(current_user.id))
    if success:
        return UnifiedResponse(data={"status": "cancelled"})
    return UnifiedResponse(data={"status": "error", "message": "取消失败"})


@router.get("/download/current", response_model=UnifiedResponse[dict[str, Any]])
async def get_current_download(
    current_user: User = Depends(get_current_user),
) -> UnifiedResponse[dict[str, Any]]:
    """获取当前用户正在进行的下载任务（如果有）"""
    info = await model_download.get_user_current_download(str(current_user.id))
    if info:
        return UnifiedResponse(data=info)
    return UnifiedResponse(data={"status": "none", "message": "没有正在进行的下载任务"})
