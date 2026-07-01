import { request } from '../utils/request';
import type { Budget, BudgetCreate, BudgetUpdate, BudgetListResponse } from '../types/budget';
import type { UnifiedResponse } from '../types/user';

export async function listBudgets(params?: {
  page?: number;
  page_size?: number;
}): Promise<UnifiedResponse<BudgetListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));

  const query = searchParams.toString();
  return request<BudgetListResponse>(`/finance/budgets/${query ? `?${query}` : ''}`);
}

export async function createBudget(data: BudgetCreate): Promise<UnifiedResponse<Budget>> {
  return request<Budget>('/finance/budgets', { method: 'POST', body: data });
}

export async function updateBudget(id: string, data: BudgetUpdate): Promise<UnifiedResponse<Budget>> {
  return request<Budget>(`/finance/budgets/${id}`, { method: 'PUT', body: data });
}

export async function deleteBudget(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/finance/budgets/${id}`, { method: 'DELETE' });
}
