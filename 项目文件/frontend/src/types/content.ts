import type { Visibility } from '../utils/visibility';

export interface Content {
  id: string;
  title: string;
  body: Record<string, unknown>;
  owner_id: string;
  visibility: Visibility;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ContentCreateRequest {
  title: string;
  body: Record<string, unknown>;
  visibility?: Visibility;
  tags?: string[];
  file_ids?: string[];
}

export interface ContentUpdateRequest {
  title?: string;
  body?: Record<string, unknown>;
  visibility?: Visibility;
  tags?: string[];
  file_ids?: string[];
}

export interface ContentListResponse {
  items: Content[];
  total: number;
}
