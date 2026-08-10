import { request } from '../utils/request';
import type {
  ProjectTodo,
  ProjectTodoCreate,
  ProjectTodoUpdate,
  ProjectTodoListResponse,
} from '../types/project-todo';
import type { UnifiedResponse } from '../types/user';

export interface ProjectTodoListParams {
  project_id: string;
  page?: number;
  page_size?: number;
  priority?: string;
  status?: string;
  assignee_id?: string;
}

export async function listProjectTodos(
  params: ProjectTodoListParams,
): Promise<UnifiedResponse<ProjectTodoListResponse>> {
  const searchParams = new URLSearchParams();
  searchParams.set('project_id', params.project_id);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.status) searchParams.set('status', params.status);
  if (params.assignee_id) searchParams.set('assignee_id', params.assignee_id);
  const query = searchParams.toString();
  return request<ProjectTodoListResponse>(`/project-todos/${query ? `?${query}` : ''}`);
}

export async function getProjectTodo(id: string): Promise<UnifiedResponse<ProjectTodo>> {
  return request<ProjectTodo>(`/project-todos/${id}`);
}

export async function createProjectTodo(
  data: ProjectTodoCreate,
): Promise<UnifiedResponse<ProjectTodo>> {
  return request<ProjectTodo>('/project-todos/', { method: 'POST', body: data });
}

export async function updateProjectTodo(
  id: string,
  data: ProjectTodoUpdate,
): Promise<UnifiedResponse<ProjectTodo>> {
  return request<ProjectTodo>(`/project-todos/${id}`, { method: 'PUT', body: data });
}

export async function deleteProjectTodo(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/project-todos/${id}`, { method: 'DELETE' });
}
