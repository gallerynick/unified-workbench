/**
 * 文件共享相关类型定义
 */

export interface FileShareRecord {
  id: string; // UUID
  original_name: string;
  file_size: number; // bytes
  mime_type: string | null;
  share_code: string; // 8-char code
  has_password: boolean;
  expires_at: string; // ISO datetime
  is_expired: boolean; // 是否已过期（宽限期内仍可管理，但不可下载）
  deleted_at: string | null; // 物理文件是否已被 Celery 清理（null 表示未清理）
  max_downloads: number | null;
  download_count: number;
  created_at: string;
}

export interface FileSharePublicInfo {
  share_code: string;
  original_name: string;
  file_size: number;
  mime_type: string | null;
  has_password: boolean;
  expires_at: string;
  is_expired: boolean; // 是否已过期（过期后不可下载）
  max_downloads: number | null;
  download_count: number;
}

export interface FileShareListResponse {
  items: FileShareRecord[];
  total: number;
}

export interface StorageInfo {
  total_space_gb: number;
  used_space_gb: number;
  free_space_gb: number;
  reserved_space_gb: number;
}
