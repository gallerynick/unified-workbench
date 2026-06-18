import { request } from '../utils/request';
import type {
  Reminder,
  ReminderCreate,
  ReminderUpdate,
  ReminderListResponse,
} from '../types/reminder';
import type { UnifiedResponse } from '../types/user';

export async function listReminders(params?: {
  page?: number;
  page_size?: number;
  status?: string;
}): Promise<UnifiedResponse<ReminderListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  return request<ReminderListResponse>(`/reminders${query ? `?${query}` : ''}`);
}

export async function getReminder(id: string): Promise<UnifiedResponse<Reminder>> {
  return request<Reminder>(`/reminders/${id}`);
}

export async function createReminder(data: ReminderCreate): Promise<UnifiedResponse<Reminder>> {
  return request<Reminder>('/reminders', {
    method: 'POST',
    body: data,
  });
}

export async function updateReminder(
  id: string,
  data: ReminderUpdate
): Promise<UnifiedResponse<Reminder>> {
  return request<Reminder>(`/reminders/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export async function deleteReminder(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/reminders/${id}`, {
    method: 'DELETE',
  });
}
