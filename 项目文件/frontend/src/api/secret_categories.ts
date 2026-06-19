import { request } from '../utils/request';
import type { SecretCategory, SecretCategoryCreate, SecretCategoryUpdate, SecretCategoryListResponse } from '../types/secret_category';
import type { UnifiedResponse } from '../types/user';

export async function listSecretCategories(params?: {
  page?: number;
  page_size?: number;
}): Promise<UnifiedResponse<SecretCategoryListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));

  const query = searchParams.toString();
  return request<SecretCategoryListResponse>(`/secret-categories${query ? `?${query}` : ''}`);
}

export async function getSecretCategory(id: string): Promise<UnifiedResponse<SecretCategory>> {
  return request<SecretCategory>(`/secret-categories/${id}`);
}

export async function createSecretCategory(data: SecretCategoryCreate): Promise<UnifiedResponse<SecretCategory>> {
  return request<SecretCategory>('/secret-categories', { method: 'POST', body: data });
}

export async function updateSecretCategory(id: string, data: SecretCategoryUpdate): Promise<UnifiedResponse<SecretCategory>> {
  return request<SecretCategory>(`/secret-categories/${id}`, { method: 'PUT', body: data });
}

export async function deleteSecretCategory(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/secret-categories/${id}`, { method: 'DELETE' });
}
