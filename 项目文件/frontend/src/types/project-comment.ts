/** 提案评论类型定义 */

export interface ProposalComment {
  id: string;
  proposal_id: string;
  creator_id: string;
  content: string;
  created_at: string;
}

export interface ProposalCommentCreate {
  proposal_id: string;
  content: string;
}

export interface ProposalCommentListResponse {
  items: ProposalComment[];
  total: number;
}