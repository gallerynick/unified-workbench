import { request } from '../utils/request';
import type {
  ProjectMember,
  ProjectMemberCreate,
  ProjectMemberUpdate,
  ProjectMemberListResponse,
} from '../types/project-member';
import type { UnifiedResponse } from '../types/user';

export interface ProjectMemberListParams {
  project_id: string;
  page?: number;
  page_size?: number;
}

export async function listProjectMembers(
  params: ProjectMemberListParams,
): Promise<UnifiedResponse<ProjectMemberListResponse>> {
  const searchParams = new URLSearchParams();
  searchParams.set('project_id', params.project_id);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  const query = searchParams.toString();
  return request<ProjectMemberListResponse>(`/project-members/${query ? `?${query}` : ''}`);
}

export async function getProjectMember(id: string): Promise<UnifiedResponse<ProjectMember>> {
  return request<ProjectMember>(`/project-members/${id}`);
}

export async function createProjectMember(
  data: ProjectMemberCreate,
): Promise<UnifiedResponse<ProjectMember>> {
  return request<ProjectMember>('/project-members/', { method: 'POST', body: data });
}

export async function updateProjectMember(
  id: string,
  data: ProjectMemberUpdate,
): Promise<UnifiedResponse<ProjectMember>> {
  return request<ProjectMember>(`/project-members/${id}`, { method: 'PUT', body: data });
}

export async function deleteProjectMember(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/project-members/${id}`, { method: 'DELETE' });
}
