import { request } from '../utils/request';
import type {
  ProjectChange,
  ProjectChangeCreate,
  ProjectChangeUpdate,
  ProjectChangeListResponse,
} from '../types/project-change';
import type { UnifiedResponse } from '../types/user';

export interface ProjectChangeListParams {
  project_id: string;
  page?: number;
  page_size?: number;
  category_major?: string;
  status?: string;
}

export async function listProjectChanges(
  params: ProjectChangeListParams,
): Promise<UnifiedResponse<ProjectChangeListResponse>> {
  const searchParams = new URLSearchParams();
  searchParams.set('project_id', params.project_id);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  if (params.category_major) searchParams.set('category_major', params.category_major);
  if (params.status) searchParams.set('status', params.status);
  const query = searchParams.toString();
  return request<ProjectChangeListResponse>(`/project-changes/${query ? `?${query}` : ''}`);
}

export async function getProjectChange(id: string): Promise<UnifiedResponse<ProjectChange>> {
  return request<ProjectChange>(`/project-changes/${id}`);
}

export async function createProjectChange(
  data: ProjectChangeCreate,
): Promise<UnifiedResponse<ProjectChange>> {
  return request<ProjectChange>('/project-changes/', { method: 'POST', body: data });
}

export async function updateProjectChange(
  id: string,
  data: ProjectChangeUpdate,
): Promise<UnifiedResponse<ProjectChange>> {
  return request<ProjectChange>(`/project-changes/${id}`, { method: 'PUT', body: data });
}

export async function deleteProjectChange(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/project-changes/${id}`, { method: 'DELETE' });
}
