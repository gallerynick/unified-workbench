import { request } from '../utils/request';
import type { FormItem, FormCreate, FormListResponse } from '../types/form';
import type { UnifiedResponse } from '../types/user';

export async function listForms(params?: { page?: number; page_size?: number }): Promise<UnifiedResponse<FormListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  const query = searchParams.toString();
  return request<FormListResponse>(`/forms${query ? `?${query}` : ''}`);
}

export async function createForm(data: FormCreate): Promise<UnifiedResponse<FormItem>> {
  return request<FormItem>('/forms', { method: 'POST', body: data });
}

export async function getForm(id: string): Promise<UnifiedResponse<FormItem>> {
  return request<FormItem>(`/forms/${id}`);
}

export async function deleteForm(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/forms/${id}`, { method: 'DELETE' });
}

export async function submitFormResponse(formId: string, data: Record<string, unknown>): Promise<UnifiedResponse<null>> {
  return request<null>(`/forms/${formId}/submit`, { method: 'POST', body: { data } });
}
