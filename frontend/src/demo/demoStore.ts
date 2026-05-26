/**
 * Store mutável + API do MODO DEMONSTRAÇÃO.
 *
 * Mantém os dados fictícios em memória (reconstruídos a cada `reset()`, ou seja
 * a cada vez que se entra no demo). O `demoApi` espelha a interface dos services
 * reais — os services chamam aqui quando `demoMode.isActive()`. Agregações
 * (resumo, dashboard, categorias, assinaturas, parcelamentos) são DERIVADAS das
 * transações do store, então editar uma transação reflete em todas as telas.
 */
import type {
  Account,
  BinanceWallet,
  Category,
  Dashboard,
  InvestmentPendingAction,
  InvestmentRule,
  Order,
  PaginatedTransactions,
  Quote,
  Transaction,
} from '@/types/api.types';
import type {
  TransactionsSummary,
  UpdateTransactionBody,
  UpdateTransactionResult,
} from '@/services/transactions.service';
import type {
  CategoryStat,
  CategoryStatsResponse,
  Installment,
  InstallmentsResponse,
  Subscription,
  SubscriptionsResponse,
  WeeklySummary,
} from '@/services/analytics.service';
import type { CreateRuleBody, UpdateRuleBody } from '@/services/investments.service';
import { AppError } from '@/lib/errorMap';
import {
  buildDemoAccounts,
  buildDemoPending,
  buildDemoPortfolio,
  buildDemoRules,
  buildDemoTransactions,
  buildDemoWallet,
  categoryById,
  demoQuote,
  DEMO_CATEGORIES,
  type DemoTransaction,
} from '@/demo/demoData';

const DAY_MS = 86_400_000;

let transactions: DemoTransaction[] = [];
let accounts: Account[] = [];
let rules: InvestmentRule[] = [];
let pending: InvestmentPendingAction[] = [];

export const demoStore = {
  /** Recria todos os dados do zero (estado limpo a cada sessão de demo). */
  reset() {
    transactions = buildDemoTransactions();
    accounts = buildDemoAccounts();
    rules = buildDemoRules();
    pending = buildDemoPending();
  },
};

// ── helpers ────────────────────────────────────────────────────────────────
const datePart = (iso: string) => iso.slice(0, 10);
const monthPart = (iso: string) => iso.slice(0, 7);
const currentYm = () => new Date().toISOString().slice(0, 7);

function isExpense(t: Transaction) {
  return t.amount < 0;
}

function applyToCategory(t: DemoTransaction, cat: Category) {
  t.categoryId = cat.id;
  t.categoryName = cat.name;
  t.categoryIcon = cat.icon;
  t.categoryColor = cat.color;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// ── derivações ───────────────────────────────────────────────────────────────
function summaryOf(list: DemoTransaction[]): TransactionsSummary {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.amount >= 0) income += t.amount;
    else expense += Math.abs(t.amount);
  }
  return { income, expense, net: income - expense, count: list.length };
}

function categoryStatsFor(list: DemoTransaction[]): CategoryStat[] {
  const map = new Map<string, CategoryStat>();
  let total = 0;
  for (const t of list) {
    if (!isExpense(t)) continue;
    const amount = Math.abs(t.amount);
    total += amount;
    const key = t.categoryId ?? 'none';
    const cur = map.get(key) ?? {
      categoryId: t.categoryId ?? '',
      categoryName: t.categoryName ?? 'Outros',
      categoryIcon: t.categoryIcon ?? null,
      categoryColor: t.categoryColor ?? null,
      totalSpent: 0,
      transactionsCount: 0,
      percentage: 0,
    };
    cur.totalSpent += amount;
    cur.transactionsCount += 1;
    map.set(key, cur);
  }
  const items = [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent);
  for (const it of items) it.percentage = total > 0 ? Math.round((it.totalSpent / total) * 100) : 0;
  return items;
}

// ── API do demo ──────────────────────────────────────────────────────────────
export const demoApi = {
  transactions: {
    list(params: Record<string, string | number | undefined>): Promise<PaginatedTransactions> {
      const accountType = params.accountType as 'BANK' | 'CREDIT' | undefined;
      const categoryId = typeof params.categoryId === 'string' ? params.categoryId : undefined;
      const startDate = typeof params.startDate === 'string' ? params.startDate : undefined;
      const endDate = typeof params.endDate === 'string' ? params.endDate : undefined;
      const ids = typeof params.accountIds === 'string' && params.accountIds
        ? new Set(params.accountIds.split(','))
        : null;
      const items = transactions.filter((t) => {
        if (accountType && t.accountType !== accountType) return false;
        if (categoryId && t.categoryId !== categoryId) return false;
        if (ids && (!t.accountId || !ids.has(t.accountId))) return false;
        const d = datePart(t.occurredAt);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
      // A aba Transações filtra mês/tipo/busca client-side; CategoryDetail filtra
      // server-side (categoria + período). Por isso honramos ambos aqui.
      return Promise.resolve({ items: clone(items), nextCursor: null });
    },

    summary(params: { startDate?: string; endDate?: string; accountIds?: string; accountType?: 'BANK' | 'CREDIT' }): Promise<TransactionsSummary> {
      const ids = params.accountIds ? new Set(params.accountIds.split(',')) : null;
      const list = transactions.filter((t) => {
        const d = datePart(t.occurredAt);
        if (params.startDate && d < params.startDate) return false;
        if (params.endDate && d > params.endDate) return false;
        if (params.accountType && t.accountType !== params.accountType) return false;
        if (ids && (!t.accountId || !ids.has(t.accountId))) return false;
        return true;
      });
      return Promise.resolve(summaryOf(list));
    },

    similar(transactionId: string): Promise<{ items: Transaction[] }> {
      const target = transactions.find((t) => t.id === transactionId);
      if (!target) return Promise.resolve({ items: [] });
      const items = transactions.filter((t) => t.id !== transactionId && t.merchantName === target.merchantName);
      return Promise.resolve({ items: clone(items) });
    },

    updateCategory(transactionId: string, categoryId: string): Promise<Transaction> {
      const cat = categoryById(categoryId);
      const target = transactions.find((t) => t.id === transactionId);
      if (!target) return Promise.reject(new Error('Transação não encontrada'));
      if (cat) {
        for (const t of transactions) if (t.merchantName === target.merchantName) applyToCategory(t, cat);
      }
      return Promise.resolve(clone(target));
    },

    update(transactionId: string, body: UpdateTransactionBody): Promise<UpdateTransactionResult> {
      const target = transactions.find((t) => t.id === transactionId);
      if (!target) return Promise.reject(new Error('Transação não encontrada'));
      const cat = body.categoryId ? categoryById(body.categoryId) : undefined;
      const similar = transactions.filter((t) => t.merchantName === target.merchantName);
      for (const t of similar) {
        if (body.alias !== undefined) t.alias = body.alias;
        if (cat) applyToCategory(t, cat);
        if (body.isSubscriptionOverride !== undefined) t.isSubscriptionOverride = body.isSubscriptionOverride;
      }
      return Promise.resolve({ updated: clone(target), affectedSimilar: Math.max(0, similar.length - 1) });
    },
  },

  accounts: {
    list(): Promise<Account[]> {
      const ym = currentYm();
      const result = clone(accounts);
      // Fatura aberta do cartão = soma dos gastos no cartão no mês atual.
      for (const acc of result) {
        for (const ba of acc.bankAccounts ?? []) {
          if (ba.type !== 'CREDIT') continue;
          const spent = transactions
            .filter((t) => t.accountId === ba.id && monthPart(t.occurredAt) === ym && t.amount < 0)
            .reduce((s, t) => s + Math.abs(t.amount), 0);
          ba.currentStatementAmount = Math.round(spent * 100) / 100;
        }
      }
      return Promise.resolve(result);
    },
    remove() { return Promise.resolve(); },
    sync() { return Promise.resolve(); },
    rename() { return Promise.resolve(); },
    setCreditCloseDay() { return Promise.resolve({ ok: true as const }); },
  },

  categories: {
    list(): Promise<Category[]> {
      return Promise.resolve(clone(DEMO_CATEGORIES));
    },
  },

  dashboard: {
    fetch(month: string): Promise<Dashboard> {
      const list = transactions.filter((t) => monthPart(t.occurredAt) === month);
      const { income, expense } = summaryOf(list);
      const stats = categoryStatsFor(list);
      const topCategories = stats.slice(0, 5).map((s) => ({
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        categoryIcon: s.categoryIcon,
        categoryColor: s.categoryColor,
        total: Math.round(s.totalSpent * 100) / 100,
        percentage: s.percentage,
      }));
      const totalBalance = accounts.reduce(
        (s, a) => s + (a.bankAccounts ?? []).filter((b) => b.type === 'BANK').reduce((bs, b) => bs + b.balance, 0),
        0
      );
      const recentTransactions = clone(list.slice(0, 6));
      return Promise.resolve({
        month,
        totalBalance,
        monthlyIncome: income,
        monthlyExpenses: expense,
        topCategories,
        recentTransactions,
      });
    },
  },

  analytics: {
    subscriptions(): Promise<SubscriptionsResponse> {
      const groups = new Map<string, DemoTransaction[]>();
      for (const t of transactions) {
        if (t.isSubscriptionOverride !== true) continue;
        const key = t.merchantName ?? t.description;
        const arr = groups.get(key) ?? [];
        arr.push(t);
        groups.set(key, arr);
      }
      const items: Subscription[] = [...groups.entries()].map(([key, arr]) => {
        arr.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
        const latest = arr[0];
        const avg = arr.reduce((s, t) => s + Math.abs(t.amount), 0) / arr.length;
        const monthlyAmount = Math.round(avg * 100) / 100;
        const lastDate = datePart(latest.occurredAt);
        const nextDate = datePart(new Date(new Date(latest.occurredAt).getTime() + 30 * DAY_MS).toISOString());
        return {
          key,
          label: latest.alias ?? latest.description,
          merchantName: latest.merchantName ?? null,
          averageAmount: monthlyAmount,
          occurrences: arr.length,
          lastDate,
          nextDate,
          monthlyAmount,
          yearlyProjection: Math.round(monthlyAmount * 12 * 100) / 100,
          recentTransactionIds: arr.slice(0, 5).map((t) => t.id),
          transactionId: latest.id,
          accountName: latest.accountName ?? null,
          categoryId: latest.categoryId ?? null,
          categoryName: latest.categoryName ?? null,
          categoryIcon: latest.categoryIcon ?? null,
          categoryColor: latest.categoryColor ?? null,
          alias: latest.alias ?? null,
          isSubscriptionOverride: latest.isSubscriptionOverride ?? null,
        };
      }).sort((a, b) => b.monthlyAmount - a.monthlyAmount);

      const monthlyTotal = items.reduce((s, i) => s + i.monthlyAmount, 0);
      return Promise.resolve({
        items,
        totals: {
          activeCount: items.length,
          monthlyTotal: Math.round(monthlyTotal * 100) / 100,
          yearlyProjection: Math.round(monthlyTotal * 12 * 100) / 100,
          averagePerService: items.length ? Math.round((monthlyTotal / items.length) * 100) / 100 : 0,
        },
      });
    },

    installments(): Promise<InstallmentsResponse> {
      const groups = new Map<string, DemoTransaction[]>();
      for (const t of transactions) {
        if (!t.installmentTotal) continue;
        const key = `${t.merchantName ?? t.description}|${t.installmentTotal}`;
        const arr = groups.get(key) ?? [];
        arr.push(t);
        groups.set(key, arr);
      }
      const items: Installment[] = [...groups.values()].map((arr) => {
        arr.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
        const latest = arr[0];
        const total = latest.installmentTotal ?? 1;
        const current = latest.installmentCurrent ?? arr.length;
        const installmentAmount = Math.abs(latest.amount);
        const totalAmount = Math.round(installmentAmount * total * 100) / 100;
        const paidAmount = Math.round(installmentAmount * current * 100) / 100;
        const remainingAmount = Math.round((totalAmount - paidAmount) * 100) / 100;
        const estimatedLastDate = datePart(
          new Date(new Date(latest.occurredAt).getTime() + (total - current) * 30 * DAY_MS).toISOString()
        );
        return {
          id: latest.id,
          description: latest.description,
          alias: latest.alias ?? null,
          merchantName: latest.merchantName ?? null,
          installmentCurrent: current,
          installmentTotal: total,
          installmentAmount,
          totalAmount,
          paidAmount,
          remainingAmount,
          progress: total > 0 ? Math.round((current / total) * 100) / 100 : 0,
          occurredAt: latest.occurredAt,
          estimatedLastDate,
          accountName: latest.accountName ?? null,
          categoryId: latest.categoryId ?? null,
          categoryName: latest.categoryName ?? null,
          categoryIcon: latest.categoryIcon ?? null,
          categoryColor: latest.categoryColor ?? null,
          isSubscriptionOverride: latest.isSubscriptionOverride ?? null,
        };
      }).sort((a, b) => b.remainingAmount - a.remainingAmount);

      const totals = {
        paid: Math.round(items.reduce((s, i) => s + i.paidAmount, 0) * 100) / 100,
        remaining: Math.round(items.reduce((s, i) => s + i.remainingAmount, 0) * 100) / 100,
        count: items.length,
      };
      return Promise.resolve({ items, totals });
    },

    categoryStats(opts: { month?: string; startDate?: string; endDate?: string } = {}): Promise<CategoryStatsResponse> {
      const month = opts.month ?? currentYm();
      const list = transactions.filter((t) => {
        if (opts.startDate && opts.endDate) {
          const d = datePart(t.occurredAt);
          return d >= opts.startDate && d <= opts.endDate;
        }
        return monthPart(t.occurredAt) === month;
      });
      const items = categoryStatsFor(list);
      const total = items.reduce((s, i) => s + i.totalSpent, 0);
      return Promise.resolve({ month, total: Math.round(total * 100) / 100, items });
    },

    weeklySummary(): Promise<WeeklySummary> {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * DAY_MS);
      const startStr = datePart(start.toISOString());
      const endStr = datePart(end.toISOString());
      const list = transactions.filter((t) => {
        const d = datePart(t.occurredAt);
        return d >= startStr && d <= endStr;
      });
      const { income, expense, net, count } = summaryOf(list);
      const topCategories = categoryStatsFor(list).slice(0, 5).map((s) => ({
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        categoryIcon: s.categoryIcon,
        categoryColor: s.categoryColor,
        total: Math.round(s.totalSpent * 100) / 100,
      }));
      return Promise.resolve({ startDate: startStr, endDate: endStr, income, expense, net, count, topCategories });
    },
  },

  portfolio: {
    get() { return Promise.resolve(buildDemoPortfolio()); },
    investmentTransactions() { return Promise.resolve({ movements: [] }); },
  },

  investments: {
    listRules(): Promise<{ rules: InvestmentRule[] }> {
      return Promise.resolve({ rules: clone(rules) });
    },
    createRule(body: CreateRuleBody): Promise<InvestmentRule> {
      const now = new Date().toISOString();
      const rule: InvestmentRule = {
        id: `demo-rule-${Date.now()}`,
        name: body.name,
        active: body.active ?? true,
        triggerType: body.triggerType,
        triggerDay: body.triggerDay ?? null,
        triggerMinAmount: body.triggerMinAmount ?? null,
        actionType: body.actionType,
        asset: body.asset,
        amountBrl: body.amountBrl,
        maxAmountBrl: body.maxAmountBrl ?? null,
        maxFiresPerMonth: body.maxFiresPerMonth ?? 1,
        firesThisMonth: 0,
        firesMonthRef: null,
        lastFiredAt: null,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      };
      rules = [rule, ...rules];
      return Promise.resolve(clone(rule));
    },
    updateRule(id: string, body: UpdateRuleBody): Promise<InvestmentRule> {
      const rule = rules.find((r) => r.id === id);
      if (!rule) return Promise.reject(new Error('Regra não encontrada'));
      Object.assign(rule, body, { updatedAt: new Date().toISOString() });
      return Promise.resolve(clone(rule));
    },
    deleteRule(id: string): Promise<void> {
      rules = rules.filter((r) => r.id !== id);
      return Promise.resolve();
    },
    listPending(): Promise<{ items: InvestmentPendingAction[] }> {
      return Promise.resolve({ items: clone(pending) });
    },
    approvePending(id: string): Promise<InvestmentPendingAction> {
      const action = pending.find((p) => p.id === id);
      if (!action) return Promise.reject(new Error('Ação não encontrada'));
      action.status = 'EXECUTED';
      action.approvedAt = new Date().toISOString();
      action.executedAt = new Date().toISOString();
      action.resultMessage = 'Ordem executada (demonstração)';
      return Promise.resolve(clone(action));
    },
    dismissPending(id: string): Promise<InvestmentPendingAction> {
      const action = pending.find((p) => p.id === id);
      if (!action) return Promise.reject(new Error('Ação não encontrada'));
      action.status = 'DISMISSED';
      return Promise.resolve(clone(action));
    },
  },

  binance: {
    wallet(): Promise<BinanceWallet> { return Promise.resolve(buildDemoWallet()); },
    quote(symbol: string): Promise<Quote> { return Promise.resolve(demoQuote(symbol)); },
    placeOrder(payload: { asset: string; amountBrl: number }): Promise<Order> {
      const price = demoQuote(payload.asset).priceBRL;
      return Promise.resolve({
        id: `demo-order-${Date.now()}`,
        symbol: payload.asset,
        side: 'buy',
        amountBRL: payload.amountBrl,
        executedQuantity: Math.round((payload.amountBrl / price) * 1e8) / 1e8,
        executedPriceBRL: price,
        status: 'filled',
        createdAt: new Date().toISOString(),
        errorMessage: null,
      });
    },
    connect() { return Promise.resolve(); },
    replace() { return Promise.resolve(); },
    disconnect() { return Promise.resolve(); },
  },

  pluggy: {
    unavailable(): Promise<never> {
      return Promise.reject(
        new AppError('DEMO_UNAVAILABLE', 'Conectar banco não está disponível no modo demonstração.')
      );
    },
  },
};
