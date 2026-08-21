import { request } from '../utils/request';
import type { UnifiedResponse } from '../types/user';

export interface UserPreferences {
  page_zoom: string;
  theme_mode: string;
}

export interface UpdateUserPreferencesRequest {
  page_zoom: string;
  theme_mode: string;
}

export async function getUserPreferences(): Promise<UnifiedResponse<UserPreferences>> {
  return request<UserPreferences>('/users/me/preferences');
}

export async function updateUserPreferences(data: UpdateUserPreferencesRequest): Promise<UnifiedResponse<UserPreferences>> {
  return request<UserPreferences>('/users/me/preferences', {
    method: 'PUT',
    body: data,
  });
}