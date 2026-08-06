import type { Visibility } from '../utils/visibility';

export interface Subscription {
  id: string;
  name: string;
  provider: string;
  amount: number;
  billing_cycle: 'monthly' | 'yearly';
  next_billing: string | null;
  status: 'active' | 'cancelled' | 'paused';
  owner_id: string;
  visibility?: Visibility;
  restricted_users?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionCreate {
  name: string;
  provider: string;
  amount: number;
  billing_cycle?: string;
  next_billing?: string;
  visibility?: Visibility;
  restricted_users?: string[];
}

export interface SubscriptionUpdate {
  name?: string;
  provider?: string;
  amount?: number;
  billing_cycle?: string;
  next_billing?: string;
  status?: string;
  visibility?: Visibility;
  restricted_users?: string[];
}

export interface SubscriptionListResponse {
  items: Subscription[];
  total: number;
}
