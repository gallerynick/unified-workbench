import { request } from '../utils/request';
import type {
  ProjectProposal,
  ProjectProposalCreate,
  ProjectProposalUpdate,
  ProjectProposalListResponse,
} from '../types/project-proposal';
import type { UnifiedResponse } from '../types/user';

export interface ProjectProposalListParams {
  project_id: string;
  page?: number;
  page_size?: number;
  type?: string;
  priority?: string;
  status?: string;
}

export async function listProjectProposals(
  params: ProjectProposalListParams,
): Promise<UnifiedResponse<ProjectProposalListResponse>> {
  const searchParams = new URLSearchParams();
  searchParams.set('project_id', params.project_id);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  if (params.type) searchParams.set('type', params.type);
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.status) searchParams.set('status', params.status);
  const query = searchParams.toString();
  return request<ProjectProposalListResponse>(`/project-proposals/${query ? `?${query}` : ''}`);
}

export async function getProjectProposal(id: string): Promise<UnifiedResponse<ProjectProposal>> {
  return request<ProjectProposal>(`/project-proposals/${id}`);
}

export async function createProjectProposal(
  data: ProjectProposalCreate,
): Promise<UnifiedResponse<ProjectProposal>> {
  return request<ProjectProposal>('/project-proposals/', { method: 'POST', body: data });
}

export async function updateProjectProposal(
  id: string,
  data: ProjectProposalUpdate,
): Promise<UnifiedResponse<ProjectProposal>> {
  return request<ProjectProposal>(`/project-proposals/${id}`, { method: 'PUT', body: data });
}

export async function deleteProjectProposal(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/project-proposals/${id}`, { method: 'DELETE' });
}
