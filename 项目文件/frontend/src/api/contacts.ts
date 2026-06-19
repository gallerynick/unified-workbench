import { request } from '../utils/request';
import type { Contact, ContactCreate, ContactUpdate, ContactListResponse } from '../types/contact';
import type { UnifiedResponse } from '../types/user';

export async function listContacts(params?: {
  page?: number;
  page_size?: number;
  contact_type?: string;
  search?: string;
}): Promise<UnifiedResponse<ContactListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.contact_type) searchParams.set('contact_type', params.contact_type);
  if (params?.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  return request<ContactListResponse>(`/contacts${query ? `?${query}` : ''}`);
}

export async function getContact(id: string): Promise<UnifiedResponse<Contact>> {
  return request<Contact>(`/contacts/${id}`);
}

export async function createContact(data: ContactCreate): Promise<UnifiedResponse<Contact>> {
  return request<Contact>('/contacts', { method: 'POST', body: data });
}

export async function updateContact(id: string, data: ContactUpdate): Promise<UnifiedResponse<Contact>> {
  return request<Contact>(`/contacts/${id}`, { method: 'PUT', body: data });
}

export async function deleteContact(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/contacts/${id}`, { method: 'DELETE' });
}
