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
