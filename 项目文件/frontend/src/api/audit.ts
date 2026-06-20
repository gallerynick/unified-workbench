import { request } from '../utils/request';
import type { AuditLogListResponse } from '../types/audit';
import type { UnifiedResponse } from '../types/user';

export async function listAuditLogs(params?: {
  page?: number;
  page_size?: number;
  action?: string;
  start_date?: string;
  end_date?: string;
}): Promise<UnifiedResponse<AuditLogListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
  if (params?.action) searchParams.set('action', params.action);
  if (params?.start_date) searchParams.set('start_date', params.start_date);
  if (params?.end_date) searchParams.set('end_date', params.end_date);

  const query = searchParams.toString();
  return request<AuditLogListResponse>(`/audit-logs/${query ? `?${query}` : ''}`);
}
