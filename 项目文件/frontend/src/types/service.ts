/**
 * 服务（Service）相关类型定义
 */

export type TargetType = 'DEVICE' | 'PERSONNEL' | 'ORGANIZATION';

export interface ServiceRecord {
  id: string;
  name: string;
  description?: string | null;
  system_id: string;
  target_type?: TargetType | null;
  target_name?: string | null;
  target_ref?: string | null;
  maintainer_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ServiceFormValues {
  name: string;
  description?: string;
  target_type?: TargetType;
  target_name?: string;
  target_ref?: string;
  maintainer_ids?: string[];
}

export interface ServiceListResponse {
  items: ServiceRecord[];
  total: number;
}
