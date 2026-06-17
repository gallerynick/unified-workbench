import type { TemplateField } from './template';

export type RecordType = 'project' | 'record';
export type RecordStatus = 'draft' | 'ongoing' | 'done' | 'archived';

export interface WorkRecord {
  id: string;
  template_id: string;
  template_snapshot: TemplateField[];
  data: Record<string, unknown>;
  type: RecordType;
  title: string;
  status: RecordStatus;
  owner_id: string;
  visibility: string;
  restricted_users?: string[];
  restricted_tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface RecordCreate {
  template_id: string;
  title: string;
  data: Record<string, unknown>;
  type: RecordType;
  visibility?: string;
  restricted_users?: string[];
  restricted_tags?: string[];
}

export interface RecordUpdate {
  title?: string;
  data?: Record<string, unknown>;
  visibility?: string;
  restricted_users?: string[];
  restricted_tags?: string[];
}

export interface RecordStatusUpdate {
  status: RecordStatus;
}

export interface RecordListResponse {
  items: WorkRecord[];
  total: number;
}
