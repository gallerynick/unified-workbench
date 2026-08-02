/**
 * 系统（System）相关类型定义
 */

export interface SystemRecord {
  id: string;
  name: string;
  description?: string | null;
  server_id: string;
  maintainer_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface SystemFormValues {
  name: string;
  description?: string;
  maintainer_ids?: string[];
}

export interface SystemListResponse {
  items: SystemRecord[];
  total: number;
}
