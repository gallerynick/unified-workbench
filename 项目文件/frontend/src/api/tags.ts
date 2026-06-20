import { request } from '../utils/request';

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface TagCreateRequest {
  name: string;
  color?: string;
}

export interface TagUpdateRequest {
  name?: string;
  color?: string;
}

export interface TagListResponse {
  items: Tag[];
  total: number;
}

export async function listTags(): Promise<{ code: number; data: TagListResponse }> {
  return request<TagListResponse>('/tags/');
}

export async function createTag(data: TagCreateRequest): Promise<{ code: number; data: Tag }> {
  return request<Tag>('/tags/', { method: 'POST', body: data });
}

export async function updateTag(id: string, data: TagUpdateRequest): Promise<{ code: number; data: Tag }> {
  return request<Tag>(`/tags/${id}`, { method: 'PUT', body: data });
}

export async function deleteTag(id: string): Promise<{ code: number; data: null }> {
  return request<null>(`/tags/${id}`, { method: 'DELETE' });
}
