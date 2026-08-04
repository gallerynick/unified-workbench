/**
 * 系统（System）相关类型定义
 */

export type SystemStatus = 'running' | 'stopped' | 'paused' | 'error';
export type SystemEnvironment = 'production' | 'staging' | 'development' | 'testing';

export interface SystemRecord {
  id: string;
  server_id: string;
  parent_system_id?: string | null;
  name: string;
  description?: string | null;
  ip?: string | null;
  os_type?: string | null;
  os_version?: string | null;
  cpu_allocated?: number | null;
  ram_allocated?: number | null;
  disk_allocated?: number | null;
  status: SystemStatus;
  environment: SystemEnvironment;
  tags: string[];
  notes?: string | null;
  maintainer_ids: string[];
  created_at: string;
  updated_at: string;
  /** 计算属性：parent_system_id 非空即为虚拟机（VM），由前端在 API 层归一化计算 */
  is_vm: boolean;
}

export interface SystemFormValues {
  name: string;
  description?: string;
  parent_system_id?: string | null;
  ip?: string;
  os_type?: string;
  os_version?: string;
  cpu_allocated?: number;
  ram_allocated?: number;
  disk_allocated?: number;
  status?: SystemStatus;
  environment?: SystemEnvironment;
  tags?: string[];
  notes?: string;
  maintainer_ids?: string[];
}

export interface SystemListResponse {
  items: SystemRecord[];
  total: number;
}
