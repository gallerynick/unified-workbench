import { request } from '../utils/request';
import type { BackupInfo, BackupListResponse } from '../types/backup';
import type { UnifiedResponse } from '../types/user';

export async function createBackup(): Promise<UnifiedResponse<BackupInfo>> {
  return request('/backups', { method: 'POST' });
}

export async function listBackups(): Promise<UnifiedResponse<BackupListResponse>> {
  return request('/backups');
}

export async function deleteBackup(filename: string): Promise<UnifiedResponse<null>> {
  return request(`/backups/${filename}`, { method: 'DELETE' });
}

export async function restoreBackup(filename: string): Promise<UnifiedResponse<null>> {
  return request('/backups/restore', { method: 'POST', body: { filename } });
}
