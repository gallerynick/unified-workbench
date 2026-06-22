import { request } from '../utils/request';
import type { SystemConfigResponse } from '../types/system_config';
import type { UnifiedResponse } from '../types/user';

export async function getConfig(key: string): Promise<UnifiedResponse<SystemConfigResponse>> {
  return request<SystemConfigResponse>(`/system-config/${key}`);
}

export async function updateConfig(
  key: string,
  value: Record<string, unknown>
): Promise<UnifiedResponse<SystemConfigResponse>> {
  return request<SystemConfigResponse>(`/system-config/${key}`, {
    method: 'PUT',
    body: { value },
  });
}

/** 获取系统初始化状态（任何已认证用户可调用，永不 404） */
export async function getSetupStatus(): Promise<UnifiedResponse<{ complete: boolean }>> {
  return request<{ complete: boolean }>('/auth/setup-status');
}

/** 标记系统初始化完成（任何已认证用户可调用） */
export async function markSetupComplete(): Promise<UnifiedResponse<{ complete: boolean }>> {
  return request<{ complete: boolean }>('/auth/setup-complete', { method: 'POST' });
}
