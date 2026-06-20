import { request } from '../utils/request';
import type { Subscription, SubscriptionCreate, SubscriptionUpdate, SubscriptionListResponse } from '../types/subscription';
import type { UnifiedResponse } from '../types/user';

export async function listSubscriptions(params?: {
  page?: number;
  page_size?: number;
}): Promise<UnifiedResponse<SubscriptionListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));

  const query = searchParams.toString();
  return request<SubscriptionListResponse>(`/finance/subscriptions/${query ? `?${query}` : ''}`);
}

export async function createSubscription(data: SubscriptionCreate): Promise<UnifiedResponse<Subscription>> {
  return request<Subscription>('/finance/subscriptions/', { method: 'POST', body: data });
}

export async function updateSubscription(id: string, data: SubscriptionUpdate): Promise<UnifiedResponse<Subscription>> {
  return request<Subscription>(`/finance/subscriptions/${id}`, { method: 'PUT', body: data });
}

export async function deleteSubscription(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/finance/subscriptions/${id}`, { method: 'DELETE' });
}
