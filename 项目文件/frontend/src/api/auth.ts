import { request } from '../utils/request';
import type {
  LoginRequest,
  TokenResponse,
  User,
  PasswordChangeRequest,
  UnifiedResponse,
} from '../types/user';

export async function login(data: LoginRequest): Promise<UnifiedResponse<TokenResponse>> {
  return request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: data,
  });
}

export async function refreshToken(refresh_token: string): Promise<UnifiedResponse<TokenResponse>> {
  return request<TokenResponse>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token },
  });
}

export async function getMe(): Promise<UnifiedResponse<User>> {
  return request<User>('/auth/me');
}

export async function updateMe(data: Partial<User>): Promise<UnifiedResponse<User>> {
  return request<User>('/auth/me', {
    method: 'PUT',
    body: data,
  });
}

export async function changePassword(data: PasswordChangeRequest): Promise<UnifiedResponse<null>> {
  return request<null>('/auth/me/password', {
    method: 'PUT',
    body: data,
  });
}
