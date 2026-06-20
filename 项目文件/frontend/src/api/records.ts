import { request } from '../utils/request';
import { getToken } from '../utils/auth';
import type {
  WorkRecord,
  RecordCreate,
  RecordUpdate,
  RecordStatusUpdate,
  RecordListResponse,
  RecordType,
  RecordStatus,
} from '../types/record';
import type { UnifiedResponse } from '../types/user';

export async function listRecords(params?: {
  page?: number;
  page_size?: number;
  type?: RecordType;
  status?: RecordStatus;
  search?: string;
}): Promise<UnifiedResponse<RecordListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.type) searchParams.set('type', params.type);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return request<RecordListResponse>(`/records/${query ? `?${query}` : ''}`);
}

export async function getRecord(id: string): Promise<UnifiedResponse<WorkRecord>> {
  return request<WorkRecord>(`/records/${id}`);
}

export async function createRecord(data: RecordCreate): Promise<UnifiedResponse<WorkRecord>> {
  return request<WorkRecord>('/records/', {
    method: 'POST',
    body: data,
  });
}

export async function updateRecord(id: string, data: RecordUpdate): Promise<UnifiedResponse<WorkRecord>> {
  return request<WorkRecord>(`/records/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export async function deleteRecord(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/records/${id}`, {
    method: 'DELETE',
  });
}

export async function updateRecordStatus(id: string, data: RecordStatusUpdate): Promise<UnifiedResponse<WorkRecord>> {
  return request<WorkRecord>(`/records/${id}/status`, {
    method: 'PUT',
    body: data,
  });
}

const BASE_URL = '/api/v1';

async function downloadBlob(id: string, format: 'word' | 'pdf' | 'excel'): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/records/${id}/export/${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('导出失败');
  return res.blob();
}

export async function exportRecordWord(id: string): Promise<Blob> {
  return downloadBlob(id, 'word');
}

export async function exportRecordPdf(id: string): Promise<Blob> {
  return downloadBlob(id, 'pdf');
}

export async function exportRecordExcel(id: string): Promise<Blob> {
  return downloadBlob(id, 'excel');
}
