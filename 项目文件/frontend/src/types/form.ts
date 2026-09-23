import type { Visibility } from '../utils/visibility';

export type { Visibility };

// 表单收集仅提供「公开 / 受限」两态（私有表单无法被他人填写）；
// 存储值仍用宽类型 Visibility，兼容迁移前已存在的 private 表单。

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
  allow_visitor: boolean;
  owner_id: string;
  visibility: Visibility;
  restricted_users: string[] | null;
  restricted_tags: string[] | null;
  created_at: string;
  updated_at: string;
  response_count?: number;
}

export interface FormCreate {
  title: string;
  description?: string;
  fields: FormField[];
  visibility?: Visibility;
  allow_visitor?: boolean;
  restricted_users?: string[];
  restricted_tags?: string[];
}

/** 表单元信息更新。字段结构（fields）创建后不可修改，故不含该字段 */
export interface FormUpdate {
  title?: string;
  description?: string | null;
  allow_visitor?: boolean;
  visibility?: Visibility;
  restricted_users?: string[] | null;
  restricted_tags?: string[] | null;
  is_active?: boolean;
}

export interface FormListResponse {
  items: FormItem[];
  total: number;
}

/** 填写页使用的公开表单定义 */
export interface FormPublic {
  id: string;
  title: string;
  description: string | null;
  fields: FormField[];
  allow_visitor: boolean;
}

export interface FormResponseItem {
  id: string;
  data: Record<string, unknown>;
  respondent_id: string | null;
  respondent_name: string;
  created_at: string;
}

export interface FormStatsOptionCount {
  option: string;
  count: number;
}

export interface FormStatsBin {
  label: string;
  count: number;
}

export interface FormNumberStats {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdev: number;
}

export interface FormStatsField {
  key: string;
  type: string;
  label: string;
  required: boolean;
  answered_count: number;
  answer_rate: number;
  option_counts?: FormStatsOptionCount[] | null;
  number_stats?: FormNumberStats | null;
  bins?: FormStatsBin[] | null;
}

export interface FormStats {
  form_id: string;
  title: string;
  description: string | null;
  total_responses: number;
  visitor_count: number;
  first_response_at: string | null;
  last_response_at: string | null;
  field_stats: FormStatsField[];
}

/** 填写者查看自己已提交的内容 */
export interface FormMyResponse {
  id: string;
  data: Record<string, unknown>;
  created_at: string;
}

export type FormExportFormat = 'xlsx' | 'csv';
