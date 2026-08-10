import { request } from '../utils/request';
import type {
  ProjectMeeting,
  ProjectMeetingCreate,
  ProjectMeetingUpdate,
  ProjectMeetingListResponse,
} from '../types/project-meeting';
import type { UnifiedResponse } from '../types/user';

export interface ProjectMeetingListParams {
  project_id: string;
  page?: number;
  page_size?: number;
  type?: string;
}

export async function listProjectMeetings(
  params: ProjectMeetingListParams,
): Promise<UnifiedResponse<ProjectMeetingListResponse>> {
  const searchParams = new URLSearchParams();
  searchParams.set('project_id', params.project_id);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  if (params.type) searchParams.set('type', params.type);
  const query = searchParams.toString();
  return request<ProjectMeetingListResponse>(`/project-meetings/${query ? `?${query}` : ''}`);
}

export async function getProjectMeeting(id: string): Promise<UnifiedResponse<ProjectMeeting>> {
  return request<ProjectMeeting>(`/project-meetings/${id}`);
}

export async function createProjectMeeting(
  data: ProjectMeetingCreate,
): Promise<UnifiedResponse<ProjectMeeting>> {
  return request<ProjectMeeting>('/project-meetings/', { method: 'POST', body: data });
}

export async function updateProjectMeeting(
  id: string,
  data: ProjectMeetingUpdate,
): Promise<UnifiedResponse<ProjectMeeting>> {
  return request<ProjectMeeting>(`/project-meetings/${id}`, { method: 'PUT', body: data });
}

export async function deleteProjectMeeting(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/project-meetings/${id}`, { method: 'DELETE' });
}
