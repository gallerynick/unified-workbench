export interface BackupInfo {
  filename: string;
  size: number;
  created_at: string;
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
