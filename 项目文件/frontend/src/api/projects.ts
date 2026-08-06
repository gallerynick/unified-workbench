import { request } from '../utils/request';
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectListResponse,
} from '../types/project';
import type { UnifiedResponse } from '../types/user';

export async function listProjects(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}): Promise<UnifiedResponse<ProjectListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return request<ProjectListResponse>(`/projects/${query ? `?${query}` : ''}`);
}

export async function getProject(id: string): Promise<UnifiedResponse<Project>> {
  return request<Project>(`/projects/${id}`);
}

export async function createProject(data: ProjectCreate): Promise<UnifiedResponse<Project>> {
  return request<Project>('/projects/', {
    method: 'POST',
    body: data as unknown as Record<string, unknown>,
  });
}

export async function updateProject(id: string, data: ProjectUpdate): Promise<UnifiedResponse<Project>> {
  return request<Project>(`/projects/${id}`, {
    method: 'PUT',
    body: data as unknown as Record<string, unknown>,
  });
}

export async function deleteProject(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/projects/${id}`, {
    method: 'DELETE',
  });
}
