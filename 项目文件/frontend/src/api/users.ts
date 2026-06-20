import { request } from '../utils/request';
import type {
  User,
  UserCreateRequest,
  UserUpdateRequest,
  PaginatedResponse,
  ListParams,
  UnifiedResponse,
} from '../types/user';

export async function listUsers(params: ListParams = {}): Promise<UnifiedResponse<PaginatedResponse<User>>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return request<PaginatedResponse<User>>(`/users/${query ? `?${query}` : ''}`);
}

export async function createUser(data: UserCreateRequest): Promise<UnifiedResponse<User>> {
  return request<User>('/users/', {
    method: 'POST',
    body: data,
  });
}

export async function getUser(id: string): Promise<UnifiedResponse<User>> {
  return request<User>(`/users/${id}`);
}

export async function updateUser(id: string, data: UserUpdateRequest): Promise<UnifiedResponse<User>> {
  return request<User>(`/users/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export async function disableUser(id: string): Promise<UnifiedResponse<User>> {
  return request<User>(`/users/${id}`, {
    method: 'DELETE',
  });
}
