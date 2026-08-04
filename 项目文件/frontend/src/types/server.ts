/**
 * 服务器（Server）相关类型定义
 */

export type ServerStatus = 'active' | 'maintenance' | 'retired';

export interface ServerRecord {
  id: string;
  name: string;
  hostname?: string | null;
  purpose?: string | null;
  location?: string | null;
  ip?: string | null;
  os?: string | null;
  cpu_cores?: number | null;
  ram_gb?: number | null;
  disk_gb?: number | null;
  model?: string | null;
  serial_number?: string | null;
  tags: string[];
  description?: string | null;
  notes?: string | null;
  status: ServerStatus;
  owner_id: string;
  maintainer_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ServerFormValues {
  name: string;
  hostname?: string;
  purpose?: string;
  location?: string;
  ip?: string;
  os?: string;
  cpu_cores?: number;
  ram_gb?: number;
  disk_gb?: number;
  model?: string;
  serial_number?: string;
  tags?: string[];
  description?: string;
  notes?: string;
  status?: ServerStatus;
  system_name?: string;
  system_description?: string;
  maintainer_ids?: string[];
}

export interface ServerListResponse {
  items: ServerRecord[];
  total: number;
}
