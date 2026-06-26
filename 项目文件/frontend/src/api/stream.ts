import { request } from '../utils/request';
import type { UnifiedResponse } from '../types/user';

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

export async function getStreamConfig(): Promise<UnifiedResponse<StreamConfig>> {
  return request<StreamConfig>('/stream/config');
}

export async function updateStreamConfig(
  config: Partial<StreamConfig>,
): Promise<UnifiedResponse<StreamConfig>> {
  return request<StreamConfig>('/stream/config', { method: 'PUT', body: config });
}

export async function getStreamKey(): Promise<UnifiedResponse<StreamKey>> {
  return request<StreamKey>('/stream/key');
}

export async function resetStreamKey(): Promise<UnifiedResponse<StreamKey>> {
  return request<StreamKey>('/stream/key/reset', { method: 'POST' });
}
