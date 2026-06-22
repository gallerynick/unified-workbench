import { request } from '../utils/request';
import type { Inventory, InventoryCreate, InventoryUpdate, InventoryListResponse } from '../types/inventory';
import type { UnifiedResponse } from '../types/user';

export async function listInventories(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}): Promise<UnifiedResponse<InventoryListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  const query = searchParams.toString();
  return request<InventoryListResponse>(`/inventory/${query ? `?${query}` : ''}`);
}

export async function getInventory(id: string): Promise<UnifiedResponse<Inventory>> {
  return request<Inventory>(`/inventory/${id}`);
}

export async function createInventory(data: InventoryCreate): Promise<UnifiedResponse<Inventory>> {
  return request<Inventory>('/inventory/', { method: 'POST', body: data });
}

export async function updateInventory(id: string, data: InventoryUpdate): Promise<UnifiedResponse<Inventory>> {
  return request<Inventory>(`/inventory/${id}`, { method: 'PUT', body: data });
}

export async function deleteInventory(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/inventory/${id}`, { method: 'DELETE' });
}
