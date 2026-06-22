export interface Note {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  tags: string[] | null;
  is_pinned: boolean;
  parent_id: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface NoteCreate {
  title: string;
  content?: string | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  is_pinned?: boolean | undefined;
  parent_id?: string | null | undefined;
}

export interface NoteUpdate {
  title?: string | undefined;
  content?: string | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  is_pinned?: boolean | undefined;
  parent_id?: string | null | undefined;
}

export interface NoteListResponse {
  items: Note[];
  total: number;
}
