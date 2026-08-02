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
