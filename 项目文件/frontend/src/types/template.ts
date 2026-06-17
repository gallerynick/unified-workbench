export interface TemplateField {
  key: string;
  type: 'text' | 'textarea' | 'richtext' | 'number' | 'datetime' | 'select' | 'multiselect' | 'boolean' | 'file' | 'image' | 'divider';
  label: string;
  required: boolean;
  default_value: unknown;
  placeholder?: string;
  sort_order: number;
  options?: string[];
  config?: Record<string, unknown>;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  schema: TemplateField[];
  version: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateCreate {
  name: string;
  category: string;
  schema: TemplateField[];
}

export interface TemplateUpdate {
  name?: string;
  category?: string;
  schema?: TemplateField[];
}

export interface TemplateListResponse {
  items: Template[];
  total: number;
}
