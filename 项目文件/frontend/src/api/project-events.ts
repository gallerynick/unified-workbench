import { request } from '../utils/request';
import type {
  ProjectEvent,
  ProjectEventCreate,
  ProjectEventUpdate,
  ProjectEventListResponse,
} from '../types/project-event';
import type { UnifiedResponse } from '../types/user';

export interface ProjectEventListParams {
  project_id: string;
  page?: number;
  page_size?: number;
  event_type?: string;
}

export async function listProjectEvents(
  params: ProjectEventListParams,
): Promise<UnifiedResponse<ProjectEventListResponse>> {
  const searchParams = new URLSearchParams();
  searchParams.set('project_id', params.project_id);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  if (params.event_type) searchParams.set('event_type', params.event_type);
  const query = searchParams.toString();
  return request<ProjectEventListResponse>(`/project-events/${query ? `?${query}` : ''}`);
}

export async function getProjectEvent(id: string): Promise<UnifiedResponse<ProjectEvent>> {
  return request<ProjectEvent>(`/project-events/${id}`);
}

export async function createProjectEvent(
  data: ProjectEventCreate,
): Promise<UnifiedResponse<ProjectEvent>> {
  return request<ProjectEvent>('/project-events/', { method: 'POST', body: data });
}

export async function updateProjectEvent(
  id: string,
  data: ProjectEventUpdate,
): Promise<UnifiedResponse<ProjectEvent>> {
  return request<ProjectEvent>(`/project-events/${id}`, { method: 'PUT', body: data });
}

export async function deleteProjectEvent(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/project-events/${id}`, { method: 'DELETE' });
}
