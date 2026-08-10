import type { Visibility } from '../utils/visibility';

export type ProjectStatus = 'draft' | 'ongoing' | 'done' | 'archived';

export interface Project {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  content: Record<string, unknown>;
  status: ProjectStatus;
  owner_id: string;
  owner_name: string;
  visibility: Visibility;
  restricted_users: string[] | null;
  restricted_tags: string[] | null;
  member_ids: string[] | null;
  created_at: string;
  updated_at: string;
  status_log: StatusLogEntry[] | null;
}
export interface StatusLogEntry {
  from_status: string;
  to_status: string;
  timestamp: string;
}

export interface ProjectCreate {
  project_id?: string;
  title: string;
  description?: string;
  content?: Record<string, unknown>;
  status?: ProjectStatus;
  visibility?: Visibility;
  restricted_users?: string[];
  restricted_tags?: string[];
  member_ids?: string[];
}

export interface ProjectUpdate {
  project_id?: string;
  title?: string;
  description?: string;
  content?: Record<string, unknown>;
  status?: ProjectStatus;
  visibility?: Visibility;
  restricted_users?: string[];
  restricted_tags?: string[];
  member_ids?: string[];
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
}
