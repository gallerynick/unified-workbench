export interface Subscription {
  id: string;
  name: string;
  provider: string;
  amount: number;
  billing_cycle: 'monthly' | 'yearly';
  next_billing: string | null;
  status: 'active' | 'cancelled' | 'paused';
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionCreate {
  name: string;
  provider: string;
  amount: number;
  billing_cycle?: string;
  next_billing?: string;
}

export interface SubscriptionUpdate {
  name?: string;
  provider?: string;
  amount?: number;
  billing_cycle?: string;
  next_billing?: string;
  status?: string;
}

export interface SubscriptionListResponse {
  items: Subscription[];
  total: number;
}
