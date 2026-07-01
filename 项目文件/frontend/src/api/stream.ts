import { request } from '../utils/request';
import { getToken } from '../utils/auth';
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
  audio_sample_rate: number;
  audio_channels: number;
  audio_processing_mode: 'standard' | 'voice' | 'direct';
  audio_noise_suppression: boolean;
  audio_echo_cancellation: boolean;
  audio_auto_gain_control: boolean;
  audio_highpass_freq: number;
  audio_compressor_threshold: number;
  audio_compressor_ratio: number;
  audio_limiter_threshold: number;
  audio_output_gain: number;
}

export interface StreamKey {
  stream_key: string;
  push_url: string;
  watch_url?: string;
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
