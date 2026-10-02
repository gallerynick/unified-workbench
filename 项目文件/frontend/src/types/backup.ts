export interface BackupInfo {
  filename: string;
  size: number;
  created_at: string;
  checksum?: string;
  table_count?: number;
  file_count?: number;
  backup_version?: string;
}

export interface BackupConfig {
  backup_dir: string;
  schedule: string;
  max_backups: number;
  enabled: boolean;
}

export interface BackupListResponse {
  items: BackupInfo[];
  total: number;
}

export interface RestoreRequest {
  filename: string;
  password: string;
}

export interface RestoreResult {
  restored_from: string;
  restored_at: string;
  table_count?: number;
  file_count?: number;
  backup_version?: string;
}
