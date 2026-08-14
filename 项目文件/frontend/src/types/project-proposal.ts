/** 项目提案类型定义 */

/** 附件链接（地址 + 说明） */
export interface AttachmentLink {
  url: string;
  description?: string | null;
}

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
  attachment_links: AttachmentLink[];
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
  attachment_links?: AttachmentLink[];
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
  attachment_links?: AttachmentLink[];
  assignee_id?: string;
}

export interface ProjectProposalListResponse {
  items: ProjectProposal[];
  total: number;
}
