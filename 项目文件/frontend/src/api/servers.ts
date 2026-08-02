import { request } from '../utils/request';
import type {
  DeployStatus,
  ServerRecord,
  ServerFormValues,
  ServerListResponse,
  ServerType,
} from '../types/server';
import type { SystemListResponse } from '../types/system';
import type { UnifiedResponse } from '../types/user';

export async function listServers(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}): Promise<UnifiedResponse<ServerListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  return request<ServerListResponse>(`/servers/${query ? `?${query}` : ''}`);
}

export async function createServer(data: ServerFormValues): Promise<UnifiedResponse<ServerRecord>> {
  return request<ServerRecord>('/servers/', { method: 'POST', body: data });
}

export async function getServer(id: string): Promise<UnifiedResponse<ServerRecord>> {
  return request<ServerRecord>(`/servers/${id}/`);
}

export async function updateServer(
  id: string,
  data: Partial<ServerFormValues>
): Promise<UnifiedResponse<ServerRecord>> {
  return request<ServerRecord>(`/servers/${id}/`, { method: 'PUT', body: data });
}

export async function deleteServer(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/servers/${id}/`, { method: 'DELETE' });
}

export async function getServerSystems(
  id: string
): Promise<UnifiedResponse<SystemListResponse>> {
  return request<SystemListResponse>(`/servers/${id}/systems/`);
}

export async function changeServerType(
  id: string,
  server_type: ServerType
): Promise<UnifiedResponse<ServerRecord>> {
  return request<ServerRecord>(`/servers/${id}/change-type/`, {
    method: 'PUT',
    body: { server_type },
  });
}

export async function updateServerDeployStatus(
  id: string,
  deploy_status: DeployStatus
): Promise<UnifiedResponse<ServerRecord>> {
  return request<ServerRecord>(`/servers/${id}/`, {
    method: 'PUT',
    body: { deploy_status },
  });
}
