import { request } from '../utils/request';
import type { Note, NoteCreate, NoteUpdate, NoteListResponse } from '../types/note';
import type { UnifiedResponse } from '../types/user';

export async function listNotes(params?: { page?: number; page_size?: number; search?: string; category?: string; parent_id?: string | null }): Promise<UnifiedResponse<NoteListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.parent_id) searchParams.set('parent_id', params.parent_id);
  const query = searchParams.toString();
  return request<NoteListResponse>(`/notes/${query ? `?${query}` : ''}`);
}

export async function listAllNotes(): Promise<UnifiedResponse<NoteListResponse>> {
  return request<NoteListResponse>('/notes/all');
}

export async function moveNote(id: string, parent_id: string | null): Promise<UnifiedResponse<Note>> {
  return request<Note>(`/notes/${id}/move`, { method: 'PUT', body: { parent_id } });
}

export async function createNote(data: NoteCreate): Promise<UnifiedResponse<Note>> {
  return request<Note>('/notes/', { method: 'POST', body: data });
}

export async function getNote(id: string): Promise<UnifiedResponse<Note>> {
  return request<Note>(`/notes/${id}`);
}

export async function updateNote(id: string, data: NoteUpdate): Promise<UnifiedResponse<Note>> {
  return request<Note>(`/notes/${id}`, { method: 'PUT', body: data });
}

export async function deleteNote(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/notes/${id}`, { method: 'DELETE' });
}
