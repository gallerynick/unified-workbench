/** 项目事件类型定义 */

export interface ProjectEvent {
  id: string;
  project_id: string;
  number: string;
  event_type: string;
  title: string;
  details: Record<string, unknown>;
  operator_id: string;
  created_at: string;
}

export interface ProjectEventCreate {
  project_id: string;
  number: string;
  event_type: string;
  title: string;
  details?: Record<string, unknown>;
}

export interface ProjectEventUpdate {
  number?: string;
  event_type?: string;
  title?: string;
  details?: Record<string, unknown>;
}

export interface ProjectEventListResponse {
  items: ProjectEvent[];
  total: number;
}
