import type { Visibility } from '../utils/visibility';

export interface FileRecord {
  id: string;
  name: string;
  stored_path: string;
  size: number;
  sha256: string;
  mime_type: string;
  folder_id: string | null;
  owner_id: string;
  visibility: Visibility;
  restricted_users: string[] | null;
  restricted_tags: string[] | null;
  expires_at: string | null;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  owner_id: string;
  visibility: Visibility;
  restricted_users: string[] | null;
  restricted_tags: string[] | null;
  expires_at: string | null;
  unified_management: boolean;
  created_at: string;
}

export interface FileListResponse {
  items: FileRecord[];
  total: number;
}

export interface FolderCreateRequest {
  name: string;
  parent_id?: string;
}

export interface FolderUpdateRequest {
  name?: string;
  visibility?: Visibility;
  restricted_users?: string[];
  restricted_tags?: string[];
  expires_at?: string | null;
  unified_management?: boolean;
}
