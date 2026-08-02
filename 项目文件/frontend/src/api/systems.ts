import { request } from '../utils/request';
import type { SystemRecord, SystemListResponse } from '../types/system';
import type { UnifiedResponse } from '../types/user';

export interface SystemCreateData {
  name: string;
  description?: string;
  server_id: string;
  maintainer_ids?: string[];
}

export async function listSystems(params?: {
  server_id?: string;
  page?: number;
  page_size?: number;
}): Promise<UnifiedResponse<SystemListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.server_id) searchParams.set('server_id', params.server_id);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  const query = searchParams.toString();
  return request<SystemListResponse>(`/systems/${query ? `?${query}` : ''}`);
}

export async function createSystem(data: SystemCreateData): Promise<UnifiedResponse<SystemRecord>> {
  return request<SystemRecord>('/systems/', { method: 'POST', body: data });
}

export async function getSystem(id: string): Promise<UnifiedResponse<SystemRecord>> {
  return request<SystemRecord>(`/systems/${id}/`);
}

export async function updateSystem(
  id: string,
  data: { name?: string; description?: string; maintainer_ids?: string[] }
): Promise<UnifiedResponse<SystemRecord>> {
  return request<SystemRecord>(`/systems/${id}/`, { method: 'PUT', body: data });
}

export async function deleteSystem(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/systems/${id}/`, { method: 'DELETE' });
}
