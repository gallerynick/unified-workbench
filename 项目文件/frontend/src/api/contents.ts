import { request } from '../utils/request';
import type {
  Content,
  ContentCreateRequest,
  ContentUpdateRequest,
  ContentListResponse,
} from '../types/content';
import type { UnifiedResponse } from '../types/user';

export async function listContents(params?: {
  search?: string;
  tag?: string;
  page?: number;
  page_size?: number;
}): Promise<UnifiedResponse<ContentListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.tag) searchParams.set('tag', params.tag);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.page_size) searchParams.set('page_size', params.page_size.toString());

  const query = searchParams.toString();
  return request<ContentListResponse>(`/contents/${query ? `?${query}` : ''}`);
}

export async function getContent(id: string): Promise<UnifiedResponse<Content>> {
  return request<Content>(`/contents/${id}`);
}

export async function createContent(data: ContentCreateRequest): Promise<UnifiedResponse<Content>> {
  return request<Content>('/contents/', {
    method: 'POST',
    body: data,
  });
}

export async function updateContent(id: string, data: ContentUpdateRequest): Promise<UnifiedResponse<Content>> {
  return request<Content>(`/contents/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export async function deleteContent(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/contents/${id}`, {
    method: 'DELETE',
  });
}
