import { request } from '../utils/request';
import type { UnifiedResponse } from '../types/user';

/** 本地 AI 模型（GGUF）状态 */
export interface LocalModelStatus {
  name: string;
  downloaded: boolean;
  /** 文件字节数，来自文件系统实测 */
  size: number | null;
  modified_at: string | null;
  /**
   * llama.cpp 侧状态：
   * loaded 已载入内存 / loading 载入中 / unloaded 有文件未载入 /
   * sleeping 空闲自动卸载 / downloading 引擎正在拉取
   */
  engine_status: string | null;
}

export interface LocalModelList {
  models: LocalModelStatus[];
}

/** 可下载模型目录项 */
export interface ModelCatalogEntry {
  name: string;
  label: string;
  size_mb: number | null;
  downloaded: boolean;
}

export interface DownloadStatus {
  task_id: string;
  model_name: string;
  status: 'pending' | 'downloading' | 'paused' | 'cancelled' | 'completed' | 'error';
  progress: number;
  total: number;
  downloaded: number;
  speed: number;
  /** 当前阶段说明（如「下载中」「完成」），后端可能不返回 */
  phase?: string;
  /** 任务开始时间戳（秒），后端可能不返回 */
  started_at: number | null;
  /** 任务已运行秒数（服务端按 started_at 推导，避免前后端时钟偏差） */
  elapsed_seconds?: number;
  updated_at: number;
  error?: string;
}

export interface LocalAIHealthStatus {
  /** ok 正常 / loading 模型载入中 / error 异常 */
  status: 'ok' | 'loading' | 'error' | string;
  reason?: string | null;
}

export interface LocalModelActionResult {
  success?: boolean;
  engine_status?: string | null;
  deleted?: boolean;
  message?: string;
}

// ── 模型清单与状态 ────────────────────────────────────────────────

export async function getLocalModels(): Promise<UnifiedResponse<LocalModelList>> {
  return request<LocalModelList>('/config/local-model/models');
}

export async function getLocalModelStatus(modelName: string): Promise<UnifiedResponse<LocalModelStatus>> {
  return request<LocalModelStatus>(`/config/local-model/models/${encodeURIComponent(modelName)}/status`);
}

export async function getModelCatalog(): Promise<UnifiedResponse<ModelCatalogEntry[]>> {
  return request<ModelCatalogEntry[]>('/config/local-model/catalog');
}

// ── 载入 / 卸载 / 删除 ───────────────────────────────────────────

export async function loadLocalModel(modelName: string): Promise<UnifiedResponse<LocalModelActionResult>> {
  return request<LocalModelActionResult>(
    `/config/local-model/models/${encodeURIComponent(modelName)}/load`,
    { method: 'POST' },
  );
}

export async function unloadLocalModel(modelName: string): Promise<UnifiedResponse<LocalModelActionResult>> {
  return request<LocalModelActionResult>(
    `/config/local-model/models/${encodeURIComponent(modelName)}/unload`,
    { method: 'POST' },
  );
}

export async function deleteLocalModel(modelName: string): Promise<UnifiedResponse<LocalModelActionResult>> {
  return request<LocalModelActionResult>(
    `/config/local-model/models/${encodeURIComponent(modelName)}`,
    { method: 'DELETE' },
  );
}

export async function getLocalAIHealth(): Promise<UnifiedResponse<LocalAIHealthStatus>> {
  return request<LocalAIHealthStatus>('/config/local-model/health');
}

// ── 下载任务 ────────────────────────────────────────────────────

export async function startModelDownload(modelName: string): Promise<UnifiedResponse<{ task_id: string }>> {
  return request<{ task_id: string }>('/config/local-model/download/start', { method: 'POST', body: { name: modelName } });
}

export async function getDownloadStatus(taskId: string): Promise<UnifiedResponse<DownloadStatus>> {
  return request<DownloadStatus>(`/config/local-model/download/${encodeURIComponent(taskId)}/status`);
}

export async function pauseDownload(taskId: string): Promise<UnifiedResponse<{ status: string }>> {
  return request<{ status: string }>(`/config/local-model/download/${encodeURIComponent(taskId)}/pause`, { method: 'POST' });
}

export async function resumeDownload(taskId: string): Promise<UnifiedResponse<{ status: string }>> {
  return request<{ status: string }>(`/config/local-model/download/${encodeURIComponent(taskId)}/resume`, { method: 'POST' });
}

export async function cancelDownload(taskId: string): Promise<UnifiedResponse<{ status: string }>> {
  return request<{ status: string }>(`/config/local-model/download/${encodeURIComponent(taskId)}/cancel`, { method: 'POST' });
}

export async function getCurrentDownload(): Promise<UnifiedResponse<DownloadStatus | { status: 'none'; message: string }>> {
  return request<DownloadStatus | { status: 'none'; message: string }>('/config/local-model/download/current');
}
