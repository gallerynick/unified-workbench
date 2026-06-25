import { request } from '../utils/request';
import type { UnifiedResponse } from '../types/user';

export interface Notification {
  id: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
}

export async function listNotifications(params?: {
  page?: number;
  page_size?: number;
  unread_only?: boolean;
}): Promise<UnifiedResponse<NotificationListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.unread_only) searchParams.set('unread_only', 'true');
  const query = searchParams.toString();
  return request<NotificationListResponse>(`/notifications/${query ? `?${query}` : ''}`);
}

export async function markAsRead(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/notifications/${id}/read`, { method: 'PUT' });
}

export async function markAllAsRead(): Promise<UnifiedResponse<null>> {
  return request<null>('/notifications/read-all', { method: 'PUT' });
}
