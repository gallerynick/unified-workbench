/**
 * 服务（Service）相关类型定义
 */

export type TargetType = 'DEVICE' | 'PERSONNEL' | 'ORGANIZATION';
export type ServiceProtocol = 'tcp' | 'udp' | 'http' | 'https';
export type ServiceStatus = 'running' | 'stopped' | 'error';

export interface ServiceRecord {
  id: string;
  name: string;
  description?: string | null;
  system_id: string;
  protocol?: ServiceProtocol | null;
  status: ServiceStatus;
  health_check_url?: string | null;
  port?: number | null;
  target_type?: TargetType | null;
  target_name?: string | null;
  maintainer_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ServiceFormValues {
  name: string;
  description?: string;
  protocol?: ServiceProtocol;
  status?: ServiceStatus;
  health_check_url?: string;
  port?: number | null;
  target_type?: TargetType;
  target_name?: string;
  maintainer_ids?: string[];
}

export interface ServiceListResponse {
  items: ServiceRecord[];
  total: number;
}
