import { request } from '../utils/request';
import type {
  Secret,
  SecretCreate,
  SecretVerifyResponse,
  SecretListResponse,
} from '../types/secret';
import type { UnifiedResponse } from '../types/user';

export async function listSecrets(params?: {
  page?: number;
  page_size?: number;
  search?: string;
}): Promise<UnifiedResponse<SecretListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return request<SecretListResponse>(`/secrets/${query ? `?${query}` : ''}`);
}

export async function getSecret(id: string): Promise<UnifiedResponse<Secret>> {
  return request<Secret>(`/secrets/${id}`);
}

export async function createSecret(data: SecretCreate): Promise<UnifiedResponse<Secret>> {
  return request<Secret>('/secrets/', {
    method: 'POST',
    body: data,
  });
}

export async function deleteSecret(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/secrets/${id}`, {
    method: 'DELETE',
  });
}

export async function verifySecret(
  id: string,
  password: string
): Promise<UnifiedResponse<SecretVerifyResponse>> {
  return request<SecretVerifyResponse>(`/secrets/${id}/verify`, {
    method: 'POST',
    body: { password },
  });
}

export async function verifyPassword(
  password: string
): Promise<UnifiedResponse<{ valid: boolean }>> {
  return request<{ valid: boolean }>('/auth/verify-password', {
    method: 'POST',
    body: { password },
  });
}
