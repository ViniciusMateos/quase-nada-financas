export type User = { id: string; name?: string | null; email: string; biometricsEnabled?: boolean };
export type LoginRequest = { email: string; password: string };
export type RegisterRequest = { email: string; password: string; name?: string };
export type LoginResponse = { accessToken: string; refreshToken: string; user: User };
export type RegisterResponse = LoginResponse;
export type BankAccount = {
  id: string;
  connectedAccountId: string;
  externalId: string;
  type: 'BANK' | 'CREDIT' | string;
  subtype?: string | null;
  name?: string | null;
  marketingName?: string | null;
  number?: string | null;
  balance: number;
  currency: 'BRL';
  lastSyncAt: string | null;
  /** Fatura atual aberta (só preenchido pra type='CREDIT'). Calculado no backend. */
  currentStatementAmount?: number;
  /** Dia do mês (1-31) em que a fatura fecha. Setado manualmente pelo user. */
  creditCloseDay?: number | null;
};
export type Account = {
  id: string;
  bankName: string;
  customName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  type?: string;
  balance?: number;
  currency?: 'BRL';
  lastSyncedAt?: string | null;
  status?: string;
  isInvestment?: boolean;
  bankAccounts?: BankAccount[];
};
export type Transaction = {
  id: string;
  accountId?: string;
  accountName?: string | null;
  accountLogoUrl?: string | null;
  occurredAt: string;
  description: string;
  originalDescription?: string;
  alias?: string | null;
  amount: number;
  currency?: 'BRL';
  merchantName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  // null = decisão automática; true = forçar assinatura; false = forçar fora
  isSubscriptionOverride?: boolean | null;
  pending?: boolean;
};
export type Category = { id: string; name: string; icon: string | null; color: string | null };
export type Dashboard = {
  month: string;
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  topCategories: Array<{ categoryId: string; categoryName: string; categoryIcon: string | null; categoryColor: string | null; total: number; percentage: number }>;
  recentTransactions: Transaction[];
};
export type PaginatedTransactions = { items: Transaction[]; nextCursor: string | null };
export type BinanceAsset = { symbol: string; name: string; quantity: number; valueBRL: number; change24h: number };
export type BinanceWallet = { connected: boolean; totalBRL: number; assets: BinanceAsset[] };
export type Quote = { symbol: string; priceBRL: number; updatedAt: string };
export type Order = {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  amountBRL: number;
  executedQuantity: number | null;
  executedPriceBRL: number | null;
  status: 'pending' | 'filled' | 'failed';
  createdAt: string;
  errorMessage: string | null;
};

export type InvestmentRule = {
  id: string;
  name: string;
  active: boolean;
  triggerType: 'monthly' | 'weekly' | 'salary_received';
  triggerDay: number | null;
  triggerMinAmount: number | null;
  actionType: 'buy_binance' | 'reminder';
  asset: string;
  amountBrl: number;
  maxAmountBrl: number | null;
  maxFiresPerMonth: number;
  firesThisMonth: number;
  firesMonthRef: string | null;
  lastFiredAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvestmentPendingAction = {
  id: string;
  ruleId: string | null;
  actionType: 'buy_binance' | 'reminder';
  asset: string;
  amountBrl: number;
  status: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'DISMISSED' | 'EXPIRED' | 'FAILED';
  dueAt: string;
  approvedAt: string | null;
  executedAt: string | null;
  resultMessage: string | null;
  executedOrderId: string | null;
  createdAt: string;
};
