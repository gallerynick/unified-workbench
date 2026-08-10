/** 项目提案类型定义 */

export interface ProjectProposal {
  id: string;
  project_id: string;
  number: string;
  title: string;
  type: string;
  priority: string;
  description: string | null;
  status: string;
  reject_reason: string | null;
  attachment_links: string[];
  creator_id: string;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectProposalCreate {
  project_id: string;
  number: string;
  title: string;
  type?: string;
  priority?: string;
  description?: string;
  status?: string;
  reject_reason?: string;
  attachment_links?: string[];
  assignee_id?: string;
}

export interface ProjectProposalUpdate {
  number?: string;
  title?: string;
  type?: string;
  priority?: string;
  description?: string;
  status?: string;
  reject_reason?: string;
  attachment_links?: string[];
  assignee_id?: string;
}

export interface ProjectProposalListResponse {
  items: ProjectProposal[];
  total: number;
}
