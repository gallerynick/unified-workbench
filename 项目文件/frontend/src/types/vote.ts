export interface Vote {
  id: string;
  title: string;
  description: string | null;
  options: string[];
  allow_multiple: boolean;
  status: string;
  deadline: string | null;
  owner_id: string;
  visibility: string;
  restricted_users: string[] | null;
  restricted_tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface VoteCreate {
  title: string;
  description?: string;
  options: string[];
  allow_multiple?: boolean;
  deadline?: string;
  visibility?: 'public' | 'private' | 'restricted';
  restricted_users?: string[] | undefined;
  restricted_tags?: string[] | undefined;
}

export interface VoteListResponse {
  items: Vote[];
  total: number;
}

export interface VoteResult {
  option: string;
  count: number;
  percentage: number;
}
