import type { Visibility } from '../utils/visibility';

export interface Content {
  id: string;
  title: string;
  body: Record<string, unknown>;
  owner_id: string;
  visibility: Visibility;
  restricted_users: string[] | null;
  restricted_tags: string[] | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ContentCreateRequest {
  title: string;
  body: Record<string, unknown>;
  visibility?: Visibility;
  restricted_users?: string[];
  restricted_tags?: string[];
  tags?: string[];
  file_ids?: string[];
}

export interface ContentUpdateRequest {
  title?: string;
  body?: Record<string, unknown>;
  visibility?: Visibility;
  restricted_users?: string[];
  restricted_tags?: string[];
  tags?: string[];
  file_ids?: string[];
}

export interface ContentListResponse {
  items: Content[];
  total: number;
}
