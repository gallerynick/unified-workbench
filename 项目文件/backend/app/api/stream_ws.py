"""WebSocket 流中继服务：推流端发送媒体数据，中继到所有观看端"""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class StreamRelay:
    """流中继管理器"""

    def __init__(self) -> None:
        # stream_key -> {"publisher": WebSocket | None, "subscribers": [WebSocket], "buffer": [bytes]}
        self.rooms: dict[str, dict] = {}

    def get_or_create_room(self, stream_key: str) -> dict:
        if stream_key not in self.rooms:
            self.rooms[stream_key] = {"publisher": None, "subscribers": [], "buffer": []}
        return self.rooms[stream_key]

    async def relay(self, stream_key: str, data: bytes) -> None:
        """将推流数据转发给所有订阅者"""
        room = self.get_or_create_room(stream_key)
        # 保留最近 100 帧用于新订阅者快速开始
        room["buffer"].append(data)
        if len(room["buffer"]) > 100:
            room["buffer"] = room["buffer"][-100:]

        dead: list[WebSocket] = []
        for sub in room["subscribers"]:
            try:
                await sub.send_bytes(data)
            except Exception:
                dead.append(sub)
        for sub in dead:
            try:
                room["subscribers"].remove(sub)
            except ValueError:
                pass

    def remove_publisher(self, stream_key: str) -> None:
        room = self.get_or_create_room(stream_key)
        room["publisher"] = None
        room["buffer"] = []

    def add_subscriber(self, stream_key: str, ws: WebSocket) -> list[bytes]:
        room = self.get_or_create_room(stream_key)
        room["subscribers"].append(ws)
        return room["buffer"]

    def remove_subscriber(self, stream_key: str, ws: WebSocket) -> None:
        room = self.get_or_create_room(stream_key)
        try:
            room["subscribers"].remove(ws)
        except ValueError:
            pass


relay = StreamRelay()


@router.websocket("/ws/stream/{stream_key}")
async def stream_websocket(websocket: WebSocket, stream_key: str):
    """WebSocket 流中继端点

    客户端连接后需发送 JSON 消息声明角色：
    {"type": "publish"}  — 推流端
    {"type": "subscribe"} — 观看端
    """
    await websocket.accept()

    role: str | None = None

    try:
        # 等待角色声明
        data = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        msg = json.loads(data)
        role = msg.get("type")

        if role == "publish":
            # 推流端：接收二进制数据并中继
            room = relay.get_or_create_room(stream_key)
            room["publisher"] = websocket
            await websocket.send_text(json.dumps({"type": "ack", "role": "publisher"}))

            while True:
                try:
                    chunk = await asyncio.wait_for(websocket.receive_bytes(), timeout=60)
                    await relay.relay(stream_key, chunk)
                except asyncio.TimeoutError:
                    continue

        elif role == "subscribe":
            # 观看端：接收中继的媒体数据
            buffer = relay.add_subscriber(stream_key, websocket)
            await websocket.send_text(json.dumps({"type": "ack", "role": "subscriber", "buffer_size": len(buffer)}))
            # 发送缓冲帧
            for chunk in buffer:
                try:
                    await websocket.send_bytes(chunk)
                except Exception:
                    break
            # 持续接收（用于保持连接）
            while True:
                try:
                    await asyncio.wait_for(websocket.receive_text(), timeout=60)
                except asyncio.TimeoutError:
                    try:
                        await websocket.send_text(json.dumps({"type": "ping"}))
                    except Exception:
                        break

        else:
            await websocket.send_text(json.dumps({"type": "error", "message": "未知角色，请使用 publish 或 subscribe"}))
            await websocket.close()

    except asyncio.TimeoutError:
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": "超时：请在 10 秒内声明角色"}))
            await websocket.close()
        except Exception:
            pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if stream_key and role == "publish":
            relay.remove_publisher(stream_key)
        elif stream_key and role == "subscribe":
            relay.remove_subscriber(stream_key, websocket)
