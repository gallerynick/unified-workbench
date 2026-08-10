import { request } from '../utils/request';
import type {
  LinkRelationCreate,
  LinkRelationListResponse,
  LinkedEntity,
} from '../types/link-relation';
import type { UnifiedResponse } from '../types/user';

export interface LinkRelationListParams {
  source_type: string;
  source_id: string;
}

export interface LinkRelationDeleteParams {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
}

/** 创建双向关联（同时插入 source→target 与 target→source） */
export async function createLink(
  source_type: string,
  source_id: string,
  target_type: string,
  target_id: string,
): Promise<UnifiedResponse<LinkRelationListResponse>> {
  const data: LinkRelationCreate = { source_type, source_id, target_type, target_id };
  return request<LinkRelationListResponse>('/link-relations/', { method: 'POST', body: data });
}

export async function listLinkRelations(
  params: LinkRelationListParams,
): Promise<UnifiedResponse<LinkRelationListResponse>> {
  const searchParams = new URLSearchParams();
  searchParams.set('source_type', params.source_type);
  searchParams.set('source_id', params.source_id);
  const query = searchParams.toString();
  return request<LinkRelationListResponse>(`/link-relations/${query ? `?${query}` : ''}`);
}

export async function getLinkedEntities(
  params: LinkRelationListParams,
): Promise<UnifiedResponse<LinkedEntity[]>> {
  const searchParams = new URLSearchParams();
  searchParams.set('source_type', params.source_type);
  searchParams.set('source_id', params.source_id);
  const query = searchParams.toString();
  return request<LinkedEntity[]>(`/link-relations/linked-entities${query ? `?${query}` : ''}`);
}

export async function deleteLink(params: LinkRelationDeleteParams): Promise<UnifiedResponse<null>> {
  const searchParams = new URLSearchParams();
  searchParams.set('source_type', params.source_type);
  searchParams.set('source_id', params.source_id);
  searchParams.set('target_type', params.target_type);
  searchParams.set('target_id', params.target_id);
  const query = searchParams.toString();
  return request<null>(`/link-relations/${query ? `?${query}` : ''}`, { method: 'DELETE' });
}
