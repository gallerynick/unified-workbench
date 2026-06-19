export interface Budget {
  id: string;
  name: string;
  category: string;
  amount: number;
  spent: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'exceeded' | 'completed';
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetCreate {
  name: string;
  category: string;
  amount: number;
  period?: string;
}

export interface BudgetUpdate {
  name?: string;
  category?: string;
  amount?: number;
  spent?: number;
  period?: string;
  status?: string;
}

export interface BudgetListResponse {
  items: Budget[];
  total: number;
}
