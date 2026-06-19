export interface SecretCategory {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
}

export interface SecretCategoryCreate {
  name: string;
  description?: string;
}

export interface SecretCategoryUpdate {
  name?: string;
  description?: string;
}

export interface SecretCategoryListResponse {
  items: SecretCategory[];
  total: number;
}
