import type { Visibility } from '../utils/visibility';

/**
 * 联系人类型预设（下拉建议项）
 *
 * 类型字段本身是自由文本（后端 VARCHAR(100)）：这三个预设供快速选择，
 * 用户也可以直接输入预设之外的自定义类型。预设之外的值在列表中按原文回显。
 */
export const CONTACT_TYPE_PRESETS: { value: string; label: string; color: string }[] = [
  { value: 'customer', label: '客户', color: 'blue' },
  { value: 'supplier', label: '供应商', color: 'green' },
  { value: 'partner', label: '合作伙伴', color: 'purple' },
];

const CONTACT_TYPE_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  CONTACT_TYPE_PRESETS.map((p) => [p.value, { label: p.label, color: p.color }])
);

/** 类型展示文案：命中预设返回中文标签，自定义类型直接回显原文 */
export function contactTypeLabel(type: string): string {
  return CONTACT_TYPE_MAP[type]?.label ?? type;
}

/** 类型 Tag 配色：命中预设返回预设色，自定义类型用 default 灰 */
export function contactTypeColor(type: string): string {
  return CONTACT_TYPE_MAP[type]?.color ?? 'default';
}

export interface Contact {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_type: string;
  tags: Record<string, unknown> | string[] | null;
  notes: string | null;
  owner_id: string;
  visibility?: Visibility;
  restricted_users?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ContactCreate {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_type?: string;
  tags?: Record<string, unknown> | string[] | null;
  notes?: string;
  visibility?: Visibility;
  restricted_users?: string[];
}

export interface ContactUpdate {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_type?: string;
  tags?: Record<string, unknown> | string[] | null;
  notes?: string;
  visibility?: Visibility;
  restricted_users?: string[];
}

export interface ContactListResponse {
  items: Contact[];
  total: number;
}
