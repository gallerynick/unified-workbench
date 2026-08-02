import { request } from '../utils/request';
import type { ServiceRecord, ServiceFormValues, ServiceListResponse } from '../types/service';
import type { UnifiedResponse } from '../types/user';

export type ServiceCreateData = ServiceFormValues & { system_id: string };

export async function listServices(params?: {
  system_id?: string;
  page?: number;
  page_size?: number;
}): Promise<UnifiedResponse<ServiceListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.system_id) searchParams.set('system_id', params.system_id);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  const query = searchParams.toString();
  return request<ServiceListResponse>(`/services/${query ? `?${query}` : ''}`);
}

export async function createService(data: ServiceCreateData): Promise<UnifiedResponse<ServiceRecord>> {
  return request<ServiceRecord>('/services/', { method: 'POST', body: data });
}

export async function getService(id: string): Promise<UnifiedResponse<ServiceRecord>> {
  return request<ServiceRecord>(`/services/${id}/`);
}

export async function updateService(
  id: string,
  data: Partial<ServiceFormValues>
): Promise<UnifiedResponse<ServiceRecord>> {
  return request<ServiceRecord>(`/services/${id}/`, { method: 'PUT', body: data });
}

export async function deleteService(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/services/${id}/`, { method: 'DELETE' });
}
