export interface Vote {
  id: string;
  title: string;
  description: string | null;
  options: string[];
  allow_multiple: boolean;
  status: string;
  deadline: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface VoteCreate {
  title: string;
  description?: string;
  options: string[];
  allow_multiple?: boolean;
  deadline?: string;
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
