import { request } from '../utils/request';
import type { Announcement, AnnouncementCreate, AnnouncementUpdate, AnnouncementListResponse } from '../types/announcement';
import type { UnifiedResponse } from '../types/user';

export async function listAnnouncements(params?: { page?: number; page_size?: number }): Promise<UnifiedResponse<AnnouncementListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  const query = searchParams.toString();
  return request<AnnouncementListResponse>(`/announcements/${query ? `?${query}` : ''}`);
}

export async function createAnnouncement(data: AnnouncementCreate): Promise<UnifiedResponse<Announcement>> {
  return request<Announcement>('/announcements/', { method: 'POST', body: data });
}

export async function updateAnnouncement(id: string, data: AnnouncementUpdate): Promise<UnifiedResponse<Announcement>> {
  return request<Announcement>(`/announcements/${id}`, { method: 'PUT', body: data });
}

export async function deleteAnnouncement(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/announcements/${id}`, { method: 'DELETE' });
}
