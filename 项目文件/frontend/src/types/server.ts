/**
 * 服务器（Server）相关类型定义
 */

export type ServerStatus = 'active' | 'maintenance' | 'retired';

/** 存储单位选项 */
export const UNIT_OPTIONS = ['KB', 'MB', 'GB', 'TB'] as const;

/** 硬件组件规格项（硬件配置单） */
export interface HardwareSpec {
  type: string;
  model: string;
  capacity?: number;
  unit?: string;
  count?: number;
  type_detail?: string;
  speed?: string;
  memory?: number;
  memory_unit?: string;
}

export interface ServerRecord {
  id: string;
  name: string;
  hostname?: string | null;
  purpose?: string | null;
  location?: string | null;
  ip?: string | null;
  os?: string | null;
  cpu_cores?: number | null;
  ram_capacity?: number | null;
  ram_unit?: string | null;
  disk_capacity?: number | null;
  disk_unit?: string | null;
  model?: string | null;
  serial_number?: string | null;
  tags: string[];
  description?: string | null;
  notes?: string | null;
  status: ServerStatus;
  owner_id: string;
  maintainer_ids: string[];
  hardware_specs: HardwareSpec[];
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
  ram_capacity?: number;
  ram_unit?: string;
  disk_capacity?: number;
  disk_unit?: string;
  model?: string;
  serial_number?: string;
  tags?: string[];
  description?: string;
  notes?: string;
  status?: ServerStatus;
  system_name?: string;
  system_description?: string;
  maintainer_ids?: string[];
  hardware_specs?: HardwareSpec[];
}

export interface ServerListResponse {
  items: ServerRecord[];
  total: number;
}
