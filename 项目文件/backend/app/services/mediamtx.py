"""MediaMTX 推流服务集成，管理活跃推流路径的查询与踢出"""

import httpx

# MediaMTX API 地址（Docker compose 内部网络）
MEDIAMTX_API = "http://mediamtx:9997"
_REQUEST_TIMEOUT = 5.0


async def get_active_paths() -> list[str]:
    """获取当前所有活跃的推流路径（即 room_id 列表），出错时返回空列表（优雅降级）"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{MEDIAMTX_API}/v3/paths/list",
                timeout=_REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            # 响应格式：{"itemCount": N, "items": [{"name": "path_name", ...}]}
            items = data.get("items", [])
            if isinstance(items, list):
                return [item["name"] for item in items if "name" in item]
            return list(items.keys())
    except Exception:
        return []


async def is_path_active(room_id: str) -> bool:
    """检查指定 room_id 是否正在推流"""
    return room_id in await get_active_paths()


async def kick_path(room_id: str) -> bool:
    """踢出指定 room_id 的推流，返回是否成功"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{MEDIAMTX_API}/v3/paths/{room_id}",
                timeout=_REQUEST_TIMEOUT,
            )
            return resp.status_code == 200
    except Exception:
        return False
