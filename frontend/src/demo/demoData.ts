/**
 * Dados fictícios do MODO DEMONSTRAÇÃO.
 *
 * Tudo aqui é fake e vive só no app (nenhuma chamada de rede). Os bancos são
 * reais (Nubank, Itaú, Inter) mas saldos, transações, parcelamentos e
 * investimentos são inventados. As transações são geradas RELATIVAS à data
 * atual (sempre os últimos ~3 meses) pra que a demo pareça atual em qualquer
 * dia. O demoStore reconstrói tudo a cada vez que se entra no demo.
 */
import type {
  Account,
  BankAccount,
  BinanceWallet,
  Category,
  InvestmentPendingAction,
  InvestmentRule,
  Quote,
  Transaction,
  User,
} from '@/types/api.types';
import type { Portfolio, PortfolioItem } from '@/services/portfolio.service';

/** Transação do demo: Transaction + campos internos pra derivar parcelamentos
 * e filtrar por tipo de conta. Os campos extras são inofensivos pra UI. */
export type DemoTransaction = Transaction & {
  /** 'BANK' (débito) | 'CREDIT' (cartão). Usado no filtro server-side do demo. */
  accountType: 'BANK' | 'CREDIT';
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
};

export const DEMO_USER: User = {
  id: 'demo-user',
  name: 'Você (demonstração)',
  email: 'demo@quasenada.app',
  biometricsEnabled: false,
};

// ────────────────────────────────────────────────────────────────────────────
// Categorias (mesmos IDs/ícones/cores dos defaults do backend)
// ────────────────────────────────────────────────────────────────────────────
export const DEMO_CATEGORIES: Category[] = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Mercado', icon: 'shopping-cart', color: '#22C55E' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Restaurantes', icon: 'utensils', color: '#EF4444' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Transporte', icon: 'car', color: '#3B82F6' },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Moradia', icon: 'home', color: '#8B5CF6' },
  { id: '00000000-0000-4000-8000-000000000005', name: 'Saúde', icon: 'heart', color: '#EC4899' },
  { id: '00000000-0000-4000-8000-000000000006', name: 'Educação', icon: 'book', color: '#F59E0B' },
  { id: '00000000-0000-4000-8000-000000000007', name: 'Lazer', icon: 'music', color: '#06B6D4' },
  { id: '00000000-0000-4000-8000-000000000008', name: 'Compras', icon: 'shopping-bag', color: '#A855F7' },
  { id: '00000000-0000-4000-8000-000000000009', name: 'Vestuário', icon: 'shirt', color: '#F472B6' },
  { id: '00000000-0000-4000-8000-00000000000A', name: 'Serviços', icon: 'wrench', color: '#64748B' },
  { id: '00000000-0000-4000-8000-00000000000C', name: 'Investimentos', icon: 'trending-up', color: '#10B981' },
  { id: '00000000-0000-4000-8000-00000000000D', name: 'Tarifas', icon: 'dollar-sign', color: '#9CA3AF' },
  { id: '00000000-0000-4000-8000-00000000000E', name: 'Salário', icon: 'briefcase', color: '#16A34A' },
  { id: '00000000-0000-4000-8000-00000000000F', name: 'Outros', icon: 'more-horizontal', color: '#6B7280' },
  { id: '00000000-0000-4000-8000-000000000010', name: 'Pagamento de fatura', icon: 'repeat', color: '#94A3B8' },
];

const CAT = {
  MERCADO: DEMO_CATEGORIES[0],
  RESTAURANTES: DEMO_CATEGORIES[1],
  TRANSPORTE: DEMO_CATEGORIES[2],
  MORADIA: DEMO_CATEGORIES[3],
  SAUDE: DEMO_CATEGORIES[4],
  LAZER: DEMO_CATEGORIES[6],
  COMPRAS: DEMO_CATEGORIES[7],
  SERVICOS: DEMO_CATEGORIES[9],
  SALARIO: DEMO_CATEGORIES[12],
} as const;

export function categoryById(id?: string | null): Category | undefined {
  return DEMO_CATEGORIES.find((c) => c.id === id);
}

// ────────────────────────────────────────────────────────────────────────────
// Contas (bancos reais, saldos fictícios)
// ────────────────────────────────────────────────────────────────────────────
const BA_NUBANK_CC = 'demo-ba-nubank-cc';
const BA_NUBANK_CREDIT = 'demo-ba-nubank-credit';
const BA_ITAU_CC = 'demo-ba-itau-cc';
const BA_INTER_CC = 'demo-ba-inter-cc';

const nowIso = () => new Date().toISOString();

function bankAccount(partial: Omit<BankAccount, 'currency' | 'lastSyncAt'> & Partial<BankAccount>): BankAccount {
  return { currency: 'BRL', lastSyncAt: nowIso(), ...partial };
}

export function buildDemoAccounts(): Account[] {
  return [
    {
      id: 'demo-acc-nubank',
      bankName: 'Nubank',
      logoUrl: null,
      primaryColor: '#820AD1',
      currency: 'BRL',
      status: 'UPDATED',
      lastSyncedAt: nowIso(),
      balance: 8450.32,
      bankAccounts: [
        bankAccount({
          id: BA_NUBANK_CC,
          connectedAccountId: 'demo-acc-nubank',
          externalId: 'demo-ext-nubank-cc',
          type: 'BANK',
          subtype: 'CHECKING_ACCOUNT',
          name: 'Conta do NuConta',
          balance: 8450.32,
        }),
        bankAccount({
          id: BA_NUBANK_CREDIT,
          connectedAccountId: 'demo-acc-nubank',
          externalId: 'demo-ext-nubank-credit',
          type: 'CREDIT',
          name: 'Cartão Nubank',
          number: '4587',
          balance: 0,
          currentStatementAmount: 0, // recalculado pelo demoStore a partir das transações
          creditCloseDay: 3,
        }),
      ],
    },
    {
      id: 'demo-acc-itau',
      bankName: 'Itaú',
      logoUrl: null,
      primaryColor: '#EC7000',
      currency: 'BRL',
      status: 'UPDATED',
      lastSyncedAt: nowIso(),
      balance: 3120.45,
      bankAccounts: [
        bankAccount({
          id: BA_ITAU_CC,
          connectedAccountId: 'demo-acc-itau',
          externalId: 'demo-ext-itau-cc',
          type: 'BANK',
          subtype: 'CHECKING_ACCOUNT',
          name: 'Conta Corrente',
          balance: 3120.45,
        }),
      ],
    },
    {
      id: 'demo-acc-inter',
      bankName: 'Inter',
      logoUrl: null,
      primaryColor: '#FF7A00',
      currency: 'BRL',
      status: 'UPDATED',
      lastSyncedAt: nowIso(),
      balance: 12680.0,
      bankAccounts: [
        bankAccount({
          id: BA_INTER_CC,
          connectedAccountId: 'demo-acc-inter',
          externalId: 'demo-ext-inter-cc',
          type: 'BANK',
          subtype: 'SAVINGS_ACCOUNT',
          name: 'Reserva de emergência',
          balance: 12680.0,
        }),
      ],
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Gerador de transações dos últimos ~3 meses (relativo a hoje)
// ────────────────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

type Spec = {
  slug: string;
  description: string;
  merchantName: string;
  amount: number;
  cat: Category;
  accountId: string;
  accountName: string;
  accountType: 'BANK' | 'CREDIT';
  isSubscription?: boolean;
};

/** Variação determinística (sem random) pra valores parecerem orgânicos. */
function vary(base: number, seed: number, spread: number): number {
  const delta = ((seed * 37) % (spread * 2)) - spread;
  return Math.round((base + delta) * 100) / 100;
}

function monthsAgo(now: Date, date: Date): number {
  return (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
}

export function buildDemoTransactions(): DemoTransaction[] {
  const now = new Date();
  const txs: DemoTransaction[] = [];

  const push = (date: Date, spec: Spec, extra?: Partial<DemoTransaction>) => {
    txs.push({
      id: `demo-${Math.round(date.getTime() / DAY_MS)}-${spec.slug}`,
      accountId: spec.accountId,
      accountName: spec.accountName,
      accountLogoUrl: null,
      accountType: spec.accountType,
      occurredAt: date.toISOString(),
      description: spec.description,
      originalDescription: spec.description,
      alias: null,
      amount: spec.amount,
      currency: 'BRL',
      merchantName: spec.merchantName,
      categoryId: spec.cat.id,
      categoryName: spec.cat.name,
      categoryIcon: spec.cat.icon,
      categoryColor: spec.cat.color,
      isSubscriptionOverride: spec.isSubscription ? true : null,
      pending: false,
      ...extra,
    });
  };

  for (let daysAgo = 1; daysAgo <= 95; daysAgo++) {
    const date = new Date(now.getTime() - daysAgo * DAY_MS);
    const dom = date.getDate();
    const mAgo = monthsAgo(now, date);

    // Recorrentes mensais por dia do mês
    if (dom === 5)
      push(date, { slug: 'salario', description: 'Salário', merchantName: 'Acme Tecnologia Ltda', amount: 6500, cat: CAT.SALARIO, accountId: BA_ITAU_CC, accountName: 'Itaú', accountType: 'BANK' });
    if (dom === 10)
      push(date, { slug: 'aluguel', description: 'Aluguel', merchantName: 'Imobiliária Lar Feliz', amount: -1800, cat: CAT.MORADIA, accountId: BA_ITAU_CC, accountName: 'Itaú', accountType: 'BANK' });
    if (dom === 9)
      push(date, { slug: 'internet', description: 'Vivo Fibra', merchantName: 'Vivo', amount: -109.9, cat: CAT.SERVICOS, accountId: BA_ITAU_CC, accountName: 'Itaú', accountType: 'BANK' });
    if (dom === 12)
      push(date, { slug: 'luz', description: 'Conta de luz', merchantName: 'Enel', amount: -vary(138, daysAgo, 35), cat: CAT.MORADIA, accountId: BA_ITAU_CC, accountName: 'Itaú', accountType: 'BANK' });
    if (dom === 6)
      push(date, { slug: 'smartfit', description: 'SmartFit', merchantName: 'SmartFit', amount: -99.9, cat: CAT.SAUDE, accountId: BA_NUBANK_CREDIT, accountName: 'Nubank', accountType: 'CREDIT', isSubscription: true });
    if (dom === 8)
      push(date, { slug: 'spotify', description: 'Spotify', merchantName: 'Spotify', amount: -21.9, cat: CAT.LAZER, accountId: BA_NUBANK_CREDIT, accountName: 'Nubank', accountType: 'CREDIT', isSubscription: true });
    if (dom === 15)
      push(date, { slug: 'netflix', description: 'Netflix', merchantName: 'Netflix', amount: -39.9, cat: CAT.LAZER, accountId: BA_NUBANK_CREDIT, accountName: 'Nubank', accountType: 'CREDIT', isSubscription: true });

    // Parcelamentos (parcela calculada pelo mês relativo)
    if (dom === 18) {
      const parcela = 3 - mAgo; // comprado há 2 meses, 6x
      if (parcela >= 1 && parcela <= 6)
        push(date, { slug: 'notebook', description: `Notebook Dell ${parcela}/6`, merchantName: 'Dell Store', amount: -583.16, cat: CAT.COMPRAS, accountId: BA_NUBANK_CREDIT, accountName: 'Nubank', accountType: 'CREDIT' }, { installmentCurrent: parcela, installmentTotal: 6 });
    }
    if (dom === 22) {
      const parcela = 4 - mAgo; // comprado há 3 meses, 10x
      if (parcela >= 1 && parcela <= 10)
        push(date, { slug: 'geladeira', description: `Geladeira Brastemp ${parcela}/10`, merchantName: 'Magazine Luiza', amount: -245.9, cat: CAT.COMPRAS, accountId: BA_NUBANK_CREDIT, accountName: 'Nubank', accountType: 'CREDIT' }, { installmentCurrent: parcela, installmentTotal: 10 });
    }

    // Gastos discricionários (espaçados deterministicamente)
    if (daysAgo % 4 === 0)
      push(date, { slug: 'ifood', description: 'iFood', merchantName: 'iFood', amount: -vary(52, daysAgo, 28), cat: CAT.RESTAURANTES, accountId: BA_NUBANK_CREDIT, accountName: 'Nubank', accountType: 'CREDIT' });
    if (daysAgo % 5 === 0)
      push(date, { slug: 'uber', description: 'Uber', merchantName: 'Uber', amount: -vary(27, daysAgo, 16), cat: CAT.TRANSPORTE, accountId: BA_NUBANK_CREDIT, accountName: 'Nubank', accountType: 'CREDIT' });
    if (daysAgo % 7 === 0)
      push(date, { slug: 'mercado', description: 'Pão de Açúcar', merchantName: 'Pão de Açúcar', amount: -vary(178, daysAgo, 90), cat: CAT.MERCADO, accountId: BA_NUBANK_CREDIT, accountName: 'Nubank', accountType: 'CREDIT' });
    if (daysAgo % 11 === 0)
      push(date, { slug: 'amazon', description: 'Amazon.com.br', merchantName: 'Amazon', amount: -vary(160, daysAgo, 130), cat: CAT.COMPRAS, accountId: BA_NUBANK_CREDIT, accountName: 'Nubank', accountType: 'CREDIT' });
    if (daysAgo % 9 === 0)
      push(date, { slug: 'farmacia', description: 'Drogasil', merchantName: 'Drogasil', amount: -vary(72, daysAgo, 40), cat: CAT.SAUDE, accountId: BA_NUBANK_CC, accountName: 'Nubank', accountType: 'BANK' });
    if (daysAgo % 13 === 0)
      push(date, { slug: 'posto', description: 'Posto Shell', merchantName: 'Shell', amount: -vary(220, daysAgo, 60), cat: CAT.TRANSPORTE, accountId: BA_NUBANK_CC, accountName: 'Nubank', accountType: 'BANK' });
  }

  // Mais recente primeiro
  return txs.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

// ────────────────────────────────────────────────────────────────────────────
// Investimentos (independentes das transações)
// ────────────────────────────────────────────────────────────────────────────
export function buildDemoPortfolio(): Portfolio {
  const btc: PortfolioItem = { id: 'demo-btc', name: 'Bitcoin', assetClass: 'Cripto', quantity: 0.018, investedBrl: 5200, currentBrl: 6840, profitBrl: 1640, profitPct: 31.54, dayChangePct: 1.8, dayChangeBrl: 121, monthChangePct: 9.4, monthChangeBrl: 588, annualRate: null, dueDate: null };
  const eth: PortfolioItem = { id: 'demo-eth', name: 'Ethereum', assetClass: 'Cripto', quantity: 0.42, investedBrl: 3100, currentBrl: 3480, profitBrl: 380, profitPct: 12.26, dayChangePct: -0.9, dayChangeBrl: -31, monthChangePct: 4.1, monthChangeBrl: 137, annualRate: null, dueDate: null };
  const tesouro: PortfolioItem = { id: 'demo-tesouro', name: 'Tesouro Selic 2029', assetClass: 'Renda Fixa', quantity: null, investedBrl: 10000, currentBrl: 10620, profitBrl: 620, profitPct: 6.2, dayChangePct: 0.04, dayChangeBrl: 4, monthChangePct: 0.9, monthChangeBrl: 94, annualRate: 11.25, dueDate: '2029-03-01' };

  const sum = (items: PortfolioItem[]) => items.reduce(
    (acc, i) => ({ invested: acc.invested + (i.investedBrl ?? 0), current: acc.current + i.currentBrl, profit: acc.profit + (i.profitBrl ?? 0) }),
    { invested: 0, current: 0, profit: 0 }
  );

  const binanceItems = [btc, eth];
  const rendaItems = [tesouro];
  const totals = sum([...binanceItems, ...rendaItems]);

  return {
    groups: [
      { source: 'Binance', items: binanceItems, totals: sum(binanceItems) },
      { source: 'Tesouro Direto', items: rendaItems, totals: sum(rendaItems) },
    ],
    totals,
    byClass: [
      { assetClass: 'Cripto', current: sum(binanceItems).current },
      { assetClass: 'Renda Fixa', current: sum(rendaItems).current },
    ],
    variation: { dayPct: 0.51, dayBrl: 94, monthPct: 3.9, monthBrl: 819 },
  };
}

export function buildDemoWallet(): BinanceWallet {
  return {
    connected: true,
    totalBRL: 10320,
    assets: [
      { symbol: 'BTC', name: 'Bitcoin', quantity: 0.018, valueBRL: 6840, change24h: 1.8 },
      { symbol: 'ETH', name: 'Ethereum', quantity: 0.42, valueBRL: 3480, change24h: -0.9 },
    ],
  };
}

export function demoQuote(symbol: string): Quote {
  const prices: Record<string, number> = { BTC: 380000, ETH: 8290, USDT: 5.45, BNB: 3120, SOL: 820 };
  return { symbol, priceBRL: prices[symbol] ?? 100, updatedAt: nowIso() };
}

export function buildDemoRules(): InvestmentRule[] {
  return [
    {
      id: 'demo-rule-1',
      name: 'Comprar BTC todo mês',
      active: true,
      triggerType: 'monthly',
      triggerDay: 6,
      triggerMinAmount: null,
      actionType: 'buy_binance',
      asset: 'BTC',
      amountBrl: 300,
      maxAmountBrl: 600,
      maxFiresPerMonth: 1,
      firesThisMonth: 1,
      firesMonthRef: new Date().toISOString().slice(0, 7),
      lastFiredAt: new Date(Date.now() - 6 * DAY_MS).toISOString(),
      lastError: null,
      createdAt: new Date(Date.now() - 90 * DAY_MS).toISOString(),
      updatedAt: new Date(Date.now() - 6 * DAY_MS).toISOString(),
    },
    {
      id: 'demo-rule-2',
      name: 'Guardar quando cair salário',
      active: false,
      triggerType: 'salary_received',
      triggerDay: null,
      triggerMinAmount: 3000,
      actionType: 'reminder',
      asset: 'ETH',
      amountBrl: 200,
      maxAmountBrl: null,
      maxFiresPerMonth: 1,
      firesThisMonth: 0,
      firesMonthRef: null,
      lastFiredAt: null,
      lastError: null,
      createdAt: new Date(Date.now() - 40 * DAY_MS).toISOString(),
      updatedAt: new Date(Date.now() - 40 * DAY_MS).toISOString(),
    },
  ];
}

export function buildDemoPending(): InvestmentPendingAction[] {
  return [
    {
      id: 'demo-pending-1',
      ruleId: 'demo-rule-1',
      actionType: 'buy_binance',
      asset: 'BTC',
      amountBrl: 300,
      status: 'PENDING',
      dueAt: new Date(Date.now() + 2 * DAY_MS).toISOString(),
      approvedAt: null,
      executedAt: null,
      resultMessage: null,
      executedOrderId: null,
      createdAt: nowIso(),
    },
  ];
}
