import { request } from '../utils/request';
import type { UnifiedResponse } from '../types/user';

/**
 * 上传接口基地址（供 Upload 组件直接 POST 使用，multipart/form-data）
 */
export const UPLOAD_BASE = '/api/v1/file-shares/';

/** 更新分享设置请求（全部可选，未传字段保持原值） */
export interface FileShareUpdateRequest {
  password?: string;
  expires_in_minutes?: number;
  expires_in_hours?: number;
  expires_in_days?: number;
  max_downloads?: number | null;
}

/** 分享记录 */
export interface FileShareItem {
  id: string;
  original_name: string;
  file_size: number;
  mime_type: string | null;
  share_code: string;
  has_password: boolean;
  expires_at: string;
  is_expired: boolean;
  deleted_at: string | null;
  max_downloads: number | null;
  download_count: number;
  created_at: string;
}

export interface FileShareListResponse {
  items: FileShareItem[];
  total: number;
}

/** 公开分享信息（无需登录） */
export interface SharePublicInfo {
  share_code: string;
  original_name: string;
  file_size: number;
  mime_type: string | null;
  has_password: boolean;
  expires_at: string;
  is_expired: boolean;
  max_downloads: number | null;
  download_count: number;
}

/** 存储空间信息（管理员） */
export interface StorageInfo {
  total_space_gb: number;
  used_space_gb: number;
  free_space_gb: number;
  reserved_space_gb: number;
}

/** 我的分享列表 */
export async function listFileShares(
  page: number,
  page_size: number
): Promise<UnifiedResponse<FileShareListResponse>> {
  return request<FileShareListResponse>(`/file-shares/?page=${page}&page_size=${page_size}`);
}

/** 查询我的分享详情 */
export async function getFileShare(id: string): Promise<UnifiedResponse<FileShareItem>> {
  return request<FileShareItem>(`/file-shares/${id}`);
}

/** 删除我的分享 */
export async function deleteFileShare(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/file-shares/${id}`, {
    method: 'DELETE',
  });
}

/** 更新分享设置（密码 / 有效期 / 最大下载次数） */
export async function updateFileShare(
  id: string,
  data: FileShareUpdateRequest
): Promise<UnifiedResponse<FileShareItem>> {
  return request<FileShareItem>(`/file-shares/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

/** 查询公开分享信息（无需登录） */
export async function getPublicShareInfo(code: string): Promise<SharePublicInfo> {
  const res = await request<SharePublicInfo>(`/public/shares/${code}`);
  return res.data;
}

/** 验证分享密码（无需登录） */
export async function verifySharePassword(code: string, password: string): Promise<boolean> {
  const res = await request<{ valid: boolean }>(`/public/shares/${code}/verify`, {
    method: 'POST',
    body: { share_code: code, password },
  });
  return res.data.valid;
}

/** 分享下载地址（无需登录，新窗口打开） */
export function getShareDownloadUrl(code: string, password?: string): string {
  const base = `/api/v1/public/shares/${code}/download`;
  return password ? `${base}?password=${encodeURIComponent(password)}` : base;
}

/** 存储空间信息（管理员） */
export async function getStorageInfo(): Promise<StorageInfo> {
  const res = await request<StorageInfo>('/file-shares/admin/storage');
  return res.data;
}

/** 更新预留空间（管理员） */
export async function updateReservedSpace(reserved_space_gb: number): Promise<void> {
  await request<null>('/file-shares/admin/storage/reserved-space', {
    method: 'PUT',
    body: { reserved_space_gb },
  });
}
