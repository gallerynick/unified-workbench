import { request } from '../utils/request';
import type { UnifiedResponse } from '../types/user';

export interface UserPreferences {
  page_zoom: string;
  theme_mode: string;
  /** 允许多处同时登录；关闭时新登录会下线该账号的其他全部会话 */
  allow_multiple_logins: boolean;
  /** 点击侧边栏模块后自动折叠模块栏 */
  auto_collapse_sidebar: boolean;
}

export interface UpdateUserPreferencesRequest {
  page_zoom: string;
  theme_mode: string;
  /** 可选：个性化页不传，保持原值 */
  allow_multiple_logins?: boolean;
  /** 可选：不传，保持原值 */
  auto_collapse_sidebar?: boolean;
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