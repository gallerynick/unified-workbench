/** 项目成员类型定义 */

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role_title: string | null;
  notes: string | null;
  is_owner: boolean;
  is_active: boolean;
  joined_at: string | null;
  left_at: string | null;
  created_at: string;
}

export interface ProjectMemberCreate {
  project_id: string;
  user_id: string;
  role_title?: string;
  notes?: string;
  is_owner?: boolean;
  is_active?: boolean;
  joined_at?: string;
  left_at?: string;
}

export interface ProjectMemberUpdate {
  role_title?: string;
  notes?: string;
  is_owner?: boolean;
  is_active?: boolean;
  joined_at?: string;
  left_at?: string | null;
}

export interface ProjectMemberListResponse {
  items: ProjectMember[];
  total: number;
}
