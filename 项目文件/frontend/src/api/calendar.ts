import { request } from '../utils/request';
import type { CalendarEvent, CalendarEventCreate, CalendarEventUpdate, CalendarEventListResponse } from '../types/calendar';
import type { UnifiedResponse } from '../types/user';

export async function listCalendarEvents(params?: {
  page?: number;
  page_size?: number;
  start_date?: string;
  end_date?: string;
}): Promise<UnifiedResponse<CalendarEventListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.start_date) searchParams.set('start_date', params.start_date);
  if (params?.end_date) searchParams.set('end_date', params.end_date);
  const query = searchParams.toString();
  return request<CalendarEventListResponse>(`/calendar${query ? `?${query}` : ''}`);
}

export async function getCalendarEvent(id: string): Promise<UnifiedResponse<CalendarEvent>> {
  return request<CalendarEvent>(`/calendar/${id}`);
}

export async function createCalendarEvent(data: CalendarEventCreate): Promise<UnifiedResponse<CalendarEvent>> {
  return request<CalendarEvent>('/calendar', { method: 'POST', body: data });
}

export async function updateCalendarEvent(id: string, data: CalendarEventUpdate): Promise<UnifiedResponse<CalendarEvent>> {
  return request<CalendarEvent>(`/calendar/${id}`, { method: 'PUT', body: data });
}

export async function deleteCalendarEvent(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/calendar/${id}`, { method: 'DELETE' });
}
