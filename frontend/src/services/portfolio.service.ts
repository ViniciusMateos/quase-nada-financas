import { apiClient } from '@/lib/apiClient';
import { demoMode } from '@/lib/demoMode';
import { demoApi } from '@/demo/demoStore';

export type PortfolioItem = {
  id: string;
  name: string;
  assetClass: string;
  quantity: number | null;
  investedBrl: number | null;
  currentBrl: number;
  profitBrl: number | null;
  profitPct: number | null;
  dayChangePct: number | null;
  dayChangeBrl: number | null;
  monthChangePct: number | null;
  monthChangeBrl: number | null;
  annualRate: number | null;
  dueDate: string | null;
};

export type PortfolioGroup = {
  source: string;
  items: PortfolioItem[];
  totals: { invested: number; current: number; profit: number };
};

export type PortfolioVariation = {
  dayPct: number | null;
  dayBrl: number | null;
  monthPct: number | null;
  monthBrl: number | null;
};

export type Portfolio = {
  groups: PortfolioGroup[];
  totals: { invested: number; current: number; profit: number };
  byClass: { assetClass: string; current: number }[];
  variation: PortfolioVariation;
};

export type PortfolioMovement = {
  id: string;
  type: string;
  date: string | null;
  amount: number;
  quantity: number | null;
};

export const portfolioService = {
  get: () =>
    demoMode.isActive() ? demoApi.portfolio.get() : apiClient.get<unknown, Portfolio>('/portfolio'),
  investmentTransactions: (id: string) =>
    demoMode.isActive()
      ? demoApi.portfolio.investmentTransactions()
      : apiClient.get<unknown, { movements: PortfolioMovement[] }>(
          `/portfolio/investments/${encodeURIComponent(id)}/transactions`
        ),
};
