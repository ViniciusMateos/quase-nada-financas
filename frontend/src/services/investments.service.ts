import { apiClient } from '@/lib/apiClient';
import type { InvestmentPendingAction, InvestmentRule } from '@/types/api.types';

export type CreateRuleBody = {
  name: string;
  active?: boolean;
  triggerType: 'monthly' | 'weekly' | 'salary_received';
  triggerDay?: number | null;
  triggerMinAmount?: number | null;
  actionType: 'buy_binance' | 'reminder';
  asset: string;
  amountBrl: number;
  maxAmountBrl?: number | null;
  maxFiresPerMonth?: number;
};

export type UpdateRuleBody = Partial<CreateRuleBody>;

export const investmentsService = {
  listRules: () =>
    apiClient.get<unknown, { rules: InvestmentRule[] }>('/investments/rules'),
  createRule: (body: CreateRuleBody) =>
    apiClient.post<CreateRuleBody, InvestmentRule>('/investments/rules', body),
  updateRule: (id: string, body: UpdateRuleBody) =>
    apiClient.patch<UpdateRuleBody, InvestmentRule>(`/investments/rules/${id}`, body),
  deleteRule: (id: string) =>
    apiClient.delete<unknown, void>(`/investments/rules/${id}`),

  listPending: (includeFinalized = false) =>
    apiClient.get<unknown, { items: InvestmentPendingAction[] }>('/investments/pending', {
      params: { includeFinalized },
    }),
  approvePending: (id: string) =>
    apiClient.post<unknown, InvestmentPendingAction>(`/investments/pending/${id}/approve`),
  dismissPending: (id: string) =>
    apiClient.post<unknown, InvestmentPendingAction>(`/investments/pending/${id}/dismiss`),
};
