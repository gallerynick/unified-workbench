import type { Visibility } from '../utils/visibility';

/**
 * Tiptap 文档树：嵌套结构不固定，故用 Record<string, unknown>。
 * 与后端 body 列（JSONB）一一对应。
 */
export type NoteBody = Record<string, unknown>;

export interface Note {
  id: string;
  title: string;
  /** 旧版纯文本正文，P1 后逐步被 body 取代，保留兼容 */
  content: string | null;
  /** Tiptap 文档树；P1 迁移后由后端写入，此前恒为 null */
  body?: NoteBody | null;
  /** 正文纯文本（供搜索与摘要用）；P1 迁移后由后端派生 */
  plain_text?: string | null;
  category: string | null;
  tags: string[] | null;
  is_pinned: boolean;
  parent_id: string | null;
  owner_id: string;
  visibility: Visibility;
  /** 后端恒返回该键；为 null 表示未授权任何人 */
  restricted_users: string[] | null;
  /** 受限可见的标签；P1 迁移后 note 表才有该列，此前恒为 null */
  restricted_tags?: string[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * 创建笔记请求体。
 *
 * 注意：后端 NoteCreate 不含 visibility / restricted_users，Pydantic 默认
 * extra=ignore 会静默丢弃，因此这里**不再声明**这两个字段——前端传入不会
 * 报错但也不会生效，声明反而会诱导写出看似可用的可见性 UI。需要按可见性
 * 创建/更新时，须先扩展后端 schema 与 service。
 */
export interface NoteCreate {
  title: string;
  content?: string | undefined;
  body?: NoteBody | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  restricted_tags?: string[] | undefined;
  is_pinned?: boolean | undefined;
  parent_id?: string | null | undefined;
}

/** 更新笔记请求体，字段含义同 NoteCreate（含同样的可见性限制）。 */
export interface NoteUpdate {
  title?: string | undefined;
  content?: string | undefined;
  body?: NoteBody | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  restricted_tags?: string[] | undefined;
  is_pinned?: boolean | undefined;
  parent_id?: string | null | undefined;
}

export interface NoteListResponse {
  items: Note[];
  total: number;
}

/** 反向链接条目：正文 wikilink 指向当前笔记的其他笔记。 */
export interface BacklinkItem {
  note_id: string;
  title: string;
  excerpt: string | null;
  updated_at: string;
}

/** 图谱节点：来自后端 note_link 服务，边来源仅 wikilink。 */
export interface GraphNode {
  id: string;
  title: string;
  category: string | null;
  is_pinned: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
}

/** 知识图谱数据：节点为可见笔记，边来自 note_link 表。 */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/** 标签及其在可见笔记中的出现次数。 */
export interface TagCount {
  tag: string;
  count: number;
}

/** 服务端草稿。note_id 为 null 表示尚未关联笔记的新笔记草稿。 */
export interface NoteDraft {
  id: string;
  note_id: string | null;
  title: string | null;
  body: NoteBody | null;
  saved_at: string;
}