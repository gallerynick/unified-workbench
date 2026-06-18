export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'disabled';
  tags: Tag[];
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserCreateRequest {
  username: string;
  password: string;
  nickname: string;
  role?: 'admin' | 'member';
  tags?: string[];
}

export interface UserUpdateRequest {
  nickname?: string;
  avatar?: string;
  role?: 'admin' | 'member';
  status?: 'active' | 'disabled';
  tags?: string[];
}

export interface PasswordChangeRequest {
  old_password: string;
  new_password: string;
}

export interface UnifiedResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export interface ListParams {
  page?: number;
  page_size?: number;
  search?: string;
}
