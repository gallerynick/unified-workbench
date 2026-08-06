import type { Visibility } from '../utils/visibility';

export interface Secret {
  id: string;
  name: string;
  secret_type: string;
  category_id?: string;
  sub_category: string;
  note?: string;
  owner_id: string;
  visibility?: Visibility;
  restricted_users?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SecretCreate {
  name: string;
  secret_type: string;
  category_id?: string;
  sub_category?: string;
  data: Record<string, unknown>;
  note?: string;
  visibility?: Visibility;
  restricted_users?: string[];
}

export interface SecretVerifyResponse {
  id: string;
  name: string;
  secret_type: string;
  data: Record<string, unknown>;
  note?: string;
  created_at: string;
}

export interface SecretListResponse {
  items: Secret[];
  total: number;
}
