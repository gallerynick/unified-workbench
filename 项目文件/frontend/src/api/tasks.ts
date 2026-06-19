import { request } from '../utils/request';
import type { Task, TaskCreate, TaskUpdate, TaskListResponse } from '../types/task';
import type { UnifiedResponse } from '../types/user';

export async function listTasks(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  priority?: string;
}): Promise<UnifiedResponse<TaskListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.priority) searchParams.set('priority', params.priority);
  const query = searchParams.toString();
  return request<TaskListResponse>(`/tasks${query ? `?${query}` : ''}`);
}

export async function getTask(id: string): Promise<UnifiedResponse<Task>> {
  return request<Task>(`/tasks/${id}`);
}

export async function createTask(data: TaskCreate): Promise<UnifiedResponse<Task>> {
  return request<Task>('/tasks', { method: 'POST', body: data });
}

export async function updateTask(id: string, data: TaskUpdate): Promise<UnifiedResponse<Task>> {
  return request<Task>(`/tasks/${id}`, { method: 'PUT', body: data });
}

export async function deleteTask(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/tasks/${id}`, { method: 'DELETE' });
}
