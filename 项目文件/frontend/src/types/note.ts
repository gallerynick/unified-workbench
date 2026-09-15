import type { Visibility } from "../utils/visibility";

export interface Note {
  id: string;
  title: string;
  content: string | null;
  /** Tiptap 文档树；P1 迁移后由后端写入，此前恒为 null */
  body?: Record<string, unknown> | null;
  /** 正文纯文本（供搜索用）；P1 迁移后由后端写入，此前恒为 null */
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
 * visibility / restricted_users 目前**后端会静默丢弃**：后端 NoteCreate 不含
 * 这两个字段，Pydantic 默认 extra=ignore，前端传了也进不了数据库，笔记仍是
 * private。保留声明仅为兼容现有 NoteModal 的可见性 UI（否则 tsc 报错），
 * 但调用方不要依赖它们生效——P1 需同步扩展后端 schema 才能真正写入。
 */
export interface NoteCreate {
  title: string;
  content?: string | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  is_pinned?: boolean | undefined;
  parent_id?: string | null | undefined;
  /** 见接口注释：当前后端忽略该字段 */
  visibility?: Visibility | undefined;
  /** 见接口注释：当前后端忽略该字段 */
  restricted_users?: string[] | undefined;
}

/** 更新笔记请求体，字段含义同 NoteCreate（含同样的可见性限制）。 */
export interface NoteUpdate {
  title?: string | undefined;
  content?: string | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  is_pinned?: boolean | undefined;
  parent_id?: string | null | undefined;
  /** 见 NoteCreate 注释：当前后端忽略该字段 */
  visibility?: Visibility | undefined;
  /** 见 NoteCreate 注释：当前后端忽略该字段 */
  restricted_users?: string[] | undefined;
}

export interface NoteListResponse {
  items: Note[];
  total: number;
}
