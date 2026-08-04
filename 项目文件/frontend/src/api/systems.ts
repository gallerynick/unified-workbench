import { request } from '../utils/request';
import type {
  SystemFormValues,
  SystemListResponse,
  SystemRecord,
} from '../types/system';
import type { UnifiedResponse } from '../types/user';

/**
 * 后端 SystemResponse.is_vm 是未序列化的计算属性（property），
 * API 响应不含该字段，前端基于 parent_system_id 非空即 VM 归一化计算。
 */
function withIsVm(record: Omit<SystemRecord, 'is_vm'>): SystemRecord {
  return { ...record, is_vm: record.parent_system_id != null };
}

export type SystemCreateData = SystemFormValues & { server_id: string };

export async function listSystems(params?: {
  server_id?: string;
  parent_system_id?: string;
  page?: number;
  page_size?: number;
}): Promise<UnifiedResponse<SystemListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.server_id) searchParams.set('server_id', params.server_id);
  if (params?.parent_system_id) searchParams.set('parent_system_id', params.parent_system_id);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  const query = searchParams.toString();
  const res = await request<SystemListResponse>(`/systems/${query ? `?${query}` : ''}`);
  if (res.code === 0) {
    return { ...res, data: { ...res.data, items: res.data.items.map(withIsVm) } };
  }
  return res;
}

export async function createSystem(data: SystemCreateData): Promise<UnifiedResponse<SystemRecord>> {
  const res = await request<SystemRecord>('/systems/', { method: 'POST', body: data });
  if (res.code === 0) {
    return { ...res, data: withIsVm(res.data) };
  }
  return res;
}

export async function getSystem(id: string): Promise<UnifiedResponse<SystemRecord>> {
  const res = await request<SystemRecord>(`/systems/${id}/`);
  if (res.code === 0) {
    return { ...res, data: withIsVm(res.data) };
  }
  return res;
}

export async function updateSystem(
  id: string,
  data: Partial<SystemFormValues>
): Promise<UnifiedResponse<SystemRecord>> {
  const res = await request<SystemRecord>(`/systems/${id}/`, { method: 'PUT', body: data });
  if (res.code === 0) {
    return { ...res, data: withIsVm(res.data) };
  }
  return res;
}

export async function deleteSystem(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/systems/${id}/`, { method: 'DELETE' });
}
