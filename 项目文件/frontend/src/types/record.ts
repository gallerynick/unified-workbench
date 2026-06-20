import type { TemplateField } from './template';
import type { Visibility } from '../utils/visibility';

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
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

export interface RecordCreate {
  template_id: string;
  title: string;
  data: Record<string, unknown>;
  type: RecordType;
  visibility?: Visibility;
}

export interface RecordUpdate {
  title?: string;
  data?: Record<string, unknown>;
  visibility?: Visibility;
}

export interface RecordStatusUpdate {
  status: RecordStatus;
}

export interface RecordListResponse {
  items: WorkRecord[];
  total: number;
}
