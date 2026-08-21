import { request } from '../utils/request';
import type {
  ProposalComment,
  ProposalCommentCreate,
  ProposalCommentListResponse,
} from '../types/project-comment';
import type { UnifiedResponse } from '../types/user';

export interface ProposalCommentListParams {
  proposal_id: string;
  page?: number;
  page_size?: number;
}

/** 获取指定提案的评论列表 */
export async function listProjectProposalComments(
  params: ProposalCommentListParams,
): Promise<UnifiedResponse<ProposalCommentListResponse>> {
  const searchParams = new URLSearchParams();
  searchParams.set('proposal_id', params.proposal_id);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  const query = searchParams.toString();
  return request<ProposalCommentListResponse>(
    `/project-proposal-comments/${query ? `?${query}` : ''}`,
  );
}

/** 为提案创建评论 */
export async function createProjectProposalComment(
  data: ProposalCommentCreate,
): Promise<UnifiedResponse<ProposalComment>> {
  return request<ProposalComment>('/project-proposal-comments/', {
    method: 'POST',
    body: data,
  });
}

/** 删除指定评论 */
export async function deleteProjectProposalComment(
  id: string,
): Promise<UnifiedResponse<null>> {
  return request<null>(`/project-proposal-comments/${id}`, { method: 'DELETE' });
}