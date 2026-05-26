import { apiClient } from '@/lib/apiClient';
import { demoMode } from '@/lib/demoMode';
import { demoApi } from '@/demo/demoStore';
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
    demoMode.isActive()
      ? demoApi.investments.listRules()
      : apiClient.get<unknown, { rules: InvestmentRule[] }>('/investments/rules'),
  createRule: (body: CreateRuleBody) =>
    demoMode.isActive()
      ? demoApi.investments.createRule(body)
      : apiClient.post<CreateRuleBody, InvestmentRule>('/investments/rules', body),
  updateRule: (id: string, body: UpdateRuleBody) =>
    demoMode.isActive()
      ? demoApi.investments.updateRule(id, body)
      : apiClient.patch<UpdateRuleBody, InvestmentRule>(`/investments/rules/${id}`, body),
  deleteRule: (id: string) =>
    demoMode.isActive()
      ? demoApi.investments.deleteRule(id)
      : apiClient.delete<unknown, void>(`/investments/rules/${id}`),

  listPending: (includeFinalized = false) =>
    demoMode.isActive()
      ? demoApi.investments.listPending()
      : apiClient.get<unknown, { items: InvestmentPendingAction[] }>('/investments/pending', {
          params: { includeFinalized },
        }),
  approvePending: (id: string) =>
    demoMode.isActive()
      ? demoApi.investments.approvePending(id)
      : apiClient.post<unknown, InvestmentPendingAction>(`/investments/pending/${id}/approve`),
  dismissPending: (id: string) =>
    demoMode.isActive()
      ? demoApi.investments.dismissPending(id)
      : apiClient.post<unknown, InvestmentPendingAction>(`/investments/pending/${id}/dismiss`),
};
