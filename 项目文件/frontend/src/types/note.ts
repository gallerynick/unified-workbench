export interface Note {
  id: string;
  title: string;
  content: string | null;
  category: string | null;
  tags: string[] | null;
  is_pinned: boolean;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface NoteCreate {
  title: string;
  content?: string;
  category?: string;
  tags?: string[];
  is_pinned?: boolean;
}

export interface NoteUpdate {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  is_pinned?: boolean;
}

export interface NoteListResponse {
  items: Note[];
  total: number;
}
