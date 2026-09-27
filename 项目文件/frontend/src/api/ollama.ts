import { request } from '../utils/request';
import type { UnifiedResponse } from '../types/user';

export interface OllamaModelStatus {
  name: string;
  downloaded: boolean;
  size: string | null;
  modified_at: string | null;
}

export interface OllamaModelList {
  models: OllamaModelStatus[];
}

export interface DownloadStatus {
  task_id: string;
  model_name: string;
  status: 'pending' | 'downloading' | 'paused' | 'cancelled' | 'completed' | 'error';
  progress: number;
  total: number;
  downloaded: number;
  speed: number;
  /** 当前阶段说明（如「下载分片 3/7」），后端可能不返回 */
  phase?: string;
  /** 任务开始时间戳（秒），后端可能不返回 */
  started_at: number | null;
  updated_at: number;
  error?: string;
}

export interface OllamaHealthStatus {
  status: 'ok' | 'error' | string;
  message?: string;
}

export interface OllamaModelActionResult {
  status: string;
  message?: string;
}
export async function getOllamaModels(): Promise<UnifiedResponse<OllamaModelList>> {
  return request<OllamaModelList>('/config/ollama/models');
}

export async function getOllamaModelStatus(modelName: string): Promise<UnifiedResponse<OllamaModelStatus>> {
  return request<OllamaModelStatus>(`/config/ollama/models/${modelName}/status`);
}

export async function pullOllamaModel(modelName: string): Promise<UnifiedResponse<OllamaModelActionResult>> {
  return request<OllamaModelActionResult>('/config/ollama/models/pull', { method: 'POST', body: { name: modelName } });
}

export async function deleteOllamaModel(modelName: string): Promise<UnifiedResponse<OllamaModelActionResult>> {
  return request<OllamaModelActionResult>(`/config/ollama/models/${modelName}`, { method: 'DELETE' });
}

export async function getOllamaHealth(): Promise<UnifiedResponse<OllamaHealthStatus>> {
  return request<OllamaHealthStatus>('/config/ollama/health');
}

// 下载管理 API
export async function startModelDownload(modelName: string): Promise<UnifiedResponse<{ task_id: string }>> {
  return request<{ task_id: string }>('/config/ollama/download/start', { method: 'POST', body: { name: modelName } });
}

export async function getDownloadStatus(taskId: string): Promise<UnifiedResponse<DownloadStatus>> {
  return request<DownloadStatus>(`/config/ollama/download/${taskId}/status`);
}

export async function pauseDownload(taskId: string): Promise<UnifiedResponse<{ status: string }>> {
  return request<{ status: string }>(`/config/ollama/download/${taskId}/pause`, { method: 'POST' });
}

export async function resumeDownload(taskId: string): Promise<UnifiedResponse<{ status: string }>> {
  return request<{ status: string }>(`/config/ollama/download/${taskId}/resume`, { method: 'POST' });
}

export async function cancelDownload(taskId: string): Promise<UnifiedResponse<{ status: string }>> {
  return request<{ status: string }>(`/config/ollama/download/${taskId}/cancel`, { method: 'POST' });
}

export async function getCurrentDownload(): Promise<UnifiedResponse<DownloadStatus | { status: 'none'; message: string }>> {
  return request<DownloadStatus | { status: 'none'; message: string }>('/config/ollama/download/current');
}