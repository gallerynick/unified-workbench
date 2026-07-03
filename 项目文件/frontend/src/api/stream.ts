import { request } from '../utils/request';
import { getToken } from '../utils/auth';
import type { UnifiedResponse } from '../types/user';
import type {
  StreamConfig,
  StreamKey,
  StreamRoom,
  StreamRoomCreate,
  StreamRoomUpdate,
  StreamRoomListResponse,
} from '../types/stream';

export async function getStreamConfig(): Promise<UnifiedResponse<StreamConfig>> {
  return request<StreamConfig>('/stream/config');
}

export async function updateStreamConfig(
  config: Partial<StreamConfig>,
): Promise<UnifiedResponse<StreamConfig>> {
  return request<StreamConfig>('/stream/config', { method: 'PUT', body: config });
}

/** @deprecated 使用 StreamRoom 替代。保留仅用于兼容旧版 */
export async function getStreamKey(): Promise<UnifiedResponse<StreamKey>> {
  return request<StreamKey>('/stream/key');
}

/** @deprecated 使用 StreamRoom 替代。保留仅用于兼容旧版 */
export async function resetStreamKey(): Promise<UnifiedResponse<StreamKey>> {
  return request<StreamKey>('/stream/key/reset', { method: 'POST' });
}

export async function runSpeedTest(dataSize: number): Promise<number> {
  const token = getToken();
  const payload = new Uint8Array(dataSize);
  const startTime = performance.now();
  const resp = await fetch('/api/v1/stream/speedtest', {
    method: 'POST',
    body: payload,
    headers: {
      'Content-Type': 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const elapsed = performance.now() - startTime;
  if (!resp.ok) throw new Error(`测速请求失败: ${resp.status}`);
  const kbps = Math.round((dataSize * 8) / elapsed);
  return kbps;
}

export async function runDownloadTest(dataSize: number): Promise<number> {
  const token = getToken();
  const startTime = performance.now();
  const resp = await fetch(`/api/v1/stream/speedtest/download?size=${dataSize}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const elapsed = performance.now() - startTime;
  if (!resp.ok) throw new Error(`下载测速失败: ${resp.status}`);
  const body = await resp.arrayBuffer();
  const kbps = Math.round((body.byteLength * 8) / elapsed);
  return kbps;
}

export async function createRoom(data: StreamRoomCreate): Promise<UnifiedResponse<StreamRoom>> {
  return request<StreamRoom>('/stream/rooms', { method: 'POST', body: data as any });
}

export async function listRooms(params?: Record<string, string>): Promise<UnifiedResponse<StreamRoomListResponse>> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<StreamRoomListResponse>(`/stream/rooms${qs}`);
}

export async function getRoom(roomId: string): Promise<UnifiedResponse<StreamRoom>> {
  return request<StreamRoom>(`/stream/rooms/${roomId}`);
}

export async function updateRoom(roomId: string, data: StreamRoomUpdate): Promise<UnifiedResponse<StreamRoom>> {
  return request<StreamRoom>(`/stream/rooms/${roomId}`, { method: 'PUT', body: data as any });
}

export async function deleteRoom(roomId: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/stream/rooms/${roomId}`, { method: 'DELETE' });
}

export async function takeoverRoom(roomId: string): Promise<UnifiedResponse<StreamRoom>> {
  return request<StreamRoom>(`/stream/rooms/${roomId}/takeover`, { method: 'POST' });
}

export async function getRoomStatus(roomId: string): Promise<UnifiedResponse<{ is_active: boolean; pusher_id: string | null; pusher_nickname: string | null }>> {
  return request<any>(`/stream/rooms/${roomId}/status`);
}
