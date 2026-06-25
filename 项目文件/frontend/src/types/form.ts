export interface FormField {
  key: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface FormItem {
  id: string;
  title: string;
  description: string | null;
  fields: FormField[];
  is_active: boolean;
  owner_id: string;
  visibility: string;
  restricted_users: string[] | null;
  restricted_tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface FormCreate {
  title: string;
  description?: string;
  fields: FormField[];
  visibility?: 'public' | 'private' | 'restricted';
  restricted_users?: string[] | undefined;
  restricted_tags?: string[] | undefined;
}

export interface FormListResponse {
  items: FormItem[];
  total: number;
}
