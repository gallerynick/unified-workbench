export interface Announcement {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_published: boolean;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementCreate {
  title: string;
  content: string;
  is_pinned?: boolean;
  is_published?: boolean;
}

export interface AnnouncementUpdate {
  title?: string;
  content?: string;
  is_pinned?: boolean;
  is_published?: boolean;
}

export interface AnnouncementListResponse {
  items: Announcement[];
  total: number;
}
