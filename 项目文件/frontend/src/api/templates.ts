import { request } from '../utils/request';
import type {
  Template,
  TemplateCreate,
  TemplateUpdate,
  TemplateListResponse,
} from '../types/template';
import type { UnifiedResponse } from '../types/user';

export async function listTemplates(params?: {
  page?: number;
  page_size?: number;
  category?: string;
  search?: string;
}): Promise<UnifiedResponse<TemplateListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return request<TemplateListResponse>(`/templates${query ? `?${query}` : ''}`);
}

export async function getTemplate(id: string): Promise<UnifiedResponse<Template>> {
  return request<Template>(`/templates/${id}`);
}

export async function createTemplate(data: TemplateCreate): Promise<UnifiedResponse<Template>> {
  return request<Template>('/templates', {
    method: 'POST',
    body: data,
  });
}

export async function updateTemplate(id: string, data: TemplateUpdate): Promise<UnifiedResponse<Template>> {
  return request<Template>(`/templates/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export async function deleteTemplate(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/templates/${id}`, {
    method: 'DELETE',
  });
}

export async function exportTemplate(id: string): Promise<Template> {
  return request<Template>(`/templates/${id}/export`).then((res) => res.data);
}

export async function importTemplate(data: Template): Promise<UnifiedResponse<Template>> {
  return request<Template>('/templates/import', {
    method: 'POST',
    body: data,
  });
}
