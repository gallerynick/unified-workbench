import type { Visibility } from '../utils/visibility';

export interface SecretCategory {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  visibility?: Visibility;
  restricted_users?: string[] | null;
  created_at: string;
}

export interface SecretCategoryCreate {
  name: string;
  description?: string;
  visibility?: Visibility;
  restricted_users?: string[];
}

export interface SecretCategoryUpdate {
  name?: string;
  description?: string;
  visibility?: Visibility;
  restricted_users?: string[];
}

export interface SecretCategoryListResponse {
  items: SecretCategory[];
  total: number;
}
