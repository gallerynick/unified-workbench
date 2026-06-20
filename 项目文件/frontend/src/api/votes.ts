import { request } from '../utils/request';
import type { Vote, VoteCreate, VoteListResponse, VoteResult } from '../types/vote';
import type { UnifiedResponse } from '../types/user';

export async function listVotes(params?: { page?: number; page_size?: number }): Promise<UnifiedResponse<VoteListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  const query = searchParams.toString();
  return request<VoteListResponse>(`/votes/${query ? `?${query}` : ''}`);
}

export async function createVote(data: VoteCreate): Promise<UnifiedResponse<Vote>> {
  return request<Vote>('/votes/', { method: 'POST', body: data });
}

export async function deleteVote(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/votes/${id}`, { method: 'DELETE' });
}

export async function submitVote(voteId: string, selectedOptions: string[]): Promise<UnifiedResponse<null>> {
  return request<null>(`/votes/${voteId}/submit`, { method: 'POST', body: { selected_options: selectedOptions } });
}

export async function getVoteResults(voteId: string): Promise<UnifiedResponse<VoteResult[]>> {
  return request<VoteResult[]>(`/votes/${voteId}/results`);
}
