import type { Visibility } from '../utils/visibility';

export type ProjectStatus = 'draft' | 'ongoing' | 'done' | 'archived';

export interface Project {
  id: string;
  project_id: string | null;
  /** 项目编号（PRJ- 前缀，后端生成或手动指定） */
  number: string | null;
  title: string;
  description: string | null;
  content: Record<string, unknown>;
  status: ProjectStatus;
  owner_id: string;
  owner_name: string;
  visibility: Visibility;
  restricted_users: string[] | null;
  restricted_tags: string[] | null;
  member_ids: string[] | null;
  /** 所属团队/部门 */
  department?: string | null;
  /** 项目语言 */
  language?: string | null;
  /** 是否开源 */
  is_open_source?: boolean;
  /** 仓库地址（开源时） */
  repo_url?: string | null;
  /** 项目优先级（立即/重要/一般/最后/待定） */
  priority?: string;
  /** 项目类型（六类+其他） */
  project_type?: string | null;
  /** 项目目标 */
  goals?: string | null;
  /** 项目需求 */
  requirements?: string | null;
  /** 附加需求（可无） */
  additional_req?: string | null;
  /** 模块划分 */
  modules?: string | null;
  /** 关联项目（可无） */
  related_projects?: string | null;
  /** 开发流程 */
  dev_process?: string | null;
  /** 成员权限配置：成员ID → 分区键 → 权限级别（如 readonly/manage） */
  member_permissions: Record<string, Record<string, string>> | null;
  created_at: string;
  updated_at: string;
  status_log: StatusLogEntry[] | null;
}
export interface StatusLogEntry {
  from_status: string;
  to_status: string;
  timestamp: string;
}

export interface ProjectCreate {
  project_id?: string;
  number?: string;
  owner_id?: string;
  title: string;
  description?: string;
  content?: Record<string, unknown>;
  status?: ProjectStatus;
  visibility?: Visibility;
  restricted_users?: string[];
  restricted_tags?: string[];
  member_ids?: string[];
  department?: string | null;
  language?: string | null;
  is_open_source?: boolean;
  repo_url?: string | null;
  priority?: string;
  project_type?: string | null;
  goals?: string | null;
  requirements?: string | null;
  additional_req?: string | null;
  modules?: string | null;
  related_projects?: string | null;
  dev_process?: string | null;
  member_permissions?: Record<string, Record<string, string>>;
}

export interface ProjectUpdate {
  project_id?: string;
  number?: string;
  title?: string;
  description?: string;
  content?: Record<string, unknown>;
  status?: ProjectStatus;
  visibility?: Visibility;
  restricted_users?: string[];
  restricted_tags?: string[];
  member_ids?: string[];
  department?: string | null;
  language?: string | null;
  is_open_source?: boolean;
  repo_url?: string | null;
  priority?: string;
  project_type?: string | null;
  goals?: string | null;
  requirements?: string | null;
  additional_req?: string | null;
  modules?: string | null;
  related_projects?: string | null;
  dev_process?: string | null;
  member_permissions?: Record<string, Record<string, string>>;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
}
