/**
 * 服务器（Server）相关类型定义
 */

export type ServerType = 'SINGLE' | 'MULTI';
export type DeployStatus = 'NORMAL' | 'PENDING_REDEPLOY' | 'REDEPLOYING';
export type ServerStatus = 'active' | 'maintenance' | 'retired';

export interface ServerRecord {
  id: string;
  name: string;
  purpose?: string | null;
  location?: string | null;
  ip?: string | null;
  port?: number | null;
  description?: string | null;
  notes?: string | null;
  status: ServerStatus;
  server_type: ServerType;
  deploy_status: DeployStatus;
  owner_id: string;
  maintainer_ids: string[];
  system_id?: string | null; // 单系统创建后返回
  created_at: string;
  updated_at: string;
}

export interface ServerFormValues {
  name: string;
  purpose?: string;
  location?: string;
  ip?: string;
  port?: number;
  description?: string;
  notes?: string;
  status?: ServerStatus;
  server_type?: ServerType;
  maintainer_ids?: string[];
}

export interface ServerListResponse {
  items: ServerRecord[];
  total: number;
}
