import { request } from '../utils/request';
import { getDeviceToken } from '../utils/device';
import type {
  LoginRequest,
  TokenResponse,
  User,
  PasswordChangeRequest,
  UnifiedResponse,
  UserNotificationConfig,
} from '../types/user';

export async function login(data: LoginRequest): Promise<UnifiedResponse<TokenResponse>> {
  return request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: data,
    headers: { 'X-Device-Token': getDeviceToken() },
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

export interface UpdateMeRequest {
  username?: string;
  nickname: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  avatar?: string;
}

export async function updateMe(data: UpdateMeRequest): Promise<UnifiedResponse<User>> {
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

export async function getNotificationConfig(): Promise<UnifiedResponse<UserNotificationConfig>> {
  return request<UserNotificationConfig>('/auth/me/notification-config');
}

export async function updateNotificationConfig(
  data: Partial<UserNotificationConfig>
): Promise<UnifiedResponse<void>> {
  return request<void>('/auth/me/notification-config', { method: 'PUT', body: data });
}
