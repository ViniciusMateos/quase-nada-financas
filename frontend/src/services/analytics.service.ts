import { apiClient } from '@/lib/apiClient';

export type Subscription = {
  key: string;
  label: string;
  merchantName: string | null;
  averageAmount: number;
  occurrences: number;
  lastDate: string;
  nextDate: string;
  monthlyAmount: number;
  yearlyProjection: number;
  recentTransactionIds: string[];
};

export type SubscriptionsResponse = {
  items: Subscription[];
  totals: {
    activeCount: number;
    monthlyTotal: number;
    yearlyProjection: number;
    averagePerService: number;
  };
};

export type CategoryStat = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  totalSpent: number;
  transactionsCount: number;
  percentage: number;
};

export type CategoryStatsResponse = {
  month: string;
  total: number;
  items: CategoryStat[];
};

export type Installment = {
  id: string;
  description: string;
  merchantName: string | null;
  installmentCurrent: number;
  installmentTotal: number;
  installmentAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  progress: number;
  occurredAt: string;
  estimatedLastDate: string | null;
};

export type InstallmentsResponse = {
  items: Installment[];
  totals: { paid: number; remaining: number; count: number };
};

export const analyticsService = {
  subscriptions: () => apiClient.get<unknown, SubscriptionsResponse>('/subscriptions'),
  categoryStats: (opts: { month?: string; startDate?: string; endDate?: string } = {}) => {
    const params: Record<string, string> = {};
    if (opts.startDate && opts.endDate) {
      params.startDate = opts.startDate;
      params.endDate = opts.endDate;
    } else if (opts.month) {
      params.month = opts.month;
    }
    return apiClient.get<unknown, CategoryStatsResponse>('/categories/stats', { params });
  },
  installments: () => apiClient.get<unknown, InstallmentsResponse>('/installments'),
};
