import { request } from '../utils/request';
import type {
  Topology,
  TopologyCreate,
  TopologyUpdate,
  TopologyListResponse,
} from '../types/topology';
import type { UnifiedResponse } from '../types/user';

export async function listTopologies(params?: {
  page?: number;
  page_size?: number;
}): Promise<UnifiedResponse<TopologyListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  const query = searchParams.toString();
  return request<TopologyListResponse>(`/topologies/${query ? `?${query}` : ''}`);
}

export async function getTopology(id: string): Promise<UnifiedResponse<Topology>> {
  return request<Topology>(`/topologies/${id}`);
}

export async function createTopology(data: TopologyCreate): Promise<UnifiedResponse<Topology>> {
  return request<Topology>('/topologies/', { method: 'POST', body: data });
}

export async function updateTopology(
  id: string,
  data: TopologyUpdate
): Promise<UnifiedResponse<Topology>> {
  return request<Topology>(`/topologies/${id}`, { method: 'PUT', body: data });
}

export async function deleteTopology(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/topologies/${id}`, { method: 'DELETE' });
}