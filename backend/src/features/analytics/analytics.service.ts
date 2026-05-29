import { prisma } from "../../config/database.js";
import { INTERNAL_TRANSFER_CATEGORY_ID } from "../categories/categories.seed.js";
import { stripInstallmentSuffix } from "../transactions/transactions.service.js";

export interface SubscriptionItem {
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
  transactionId: string;
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  alias: string | null;
  isSubscriptionOverride: boolean | null;
}

export interface SubscriptionsPayload {
  items: SubscriptionItem[];
  totals: {
    activeCount: number;
    monthlyTotal: number;
    yearlyProjection: number;
    averagePerService: number;
  };
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  totalSpent: number;
  transactionsCount: number;
  percentage: number;
}

export interface InstallmentItem {
  id: string;
  description: string;
  alias: string | null;
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
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  isSubscriptionOverride: boolean | null;
}

export class AnalyticsService {
  /**
   * Detecta assinaturas com regras conservadoras:
   *   1) sub-agrupa por (chave + valor arredondado em R$1) → mesma cobrança
   *      em meses diferentes deve ter VALOR IGUAL pra contar como assinatura
   *   2) serviços conhecidos (Netflix, TIM, Spotify...) precisam só de 1 ocorrência
   *      no último mês pra contar
   *   3) demais merchants precisam >= 2 ocorrências do mesmo valor em meses
   *      DIFERENTES (não 2 cobranças no mesmo mês)
   * monthlyAmount = valor real cobrado (não média), nextDate = última + ~30 dias.
   */
  async getSubscriptions(userId: string): Promise<SubscriptionsPayload> {
    const since = new Date();
    since.setMonth(since.getMonth() - 6);

    const txs = await prisma.transaction.findMany({
      where: {
        bankAccount: { connectedAccount: { userId } },
        amount: { lt: 0 },
        occurredAt: { gte: since },
        categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
        // override negativo: exclui completamente do algoritmo
        NOT: { isSubscriptionOverride: false },
      },
      orderBy: { occurredAt: "asc" },
      select: {
        id: true,
        amount: true,
        description: true,
        alias: true,
        merchantName: true,
        occurredAt: true,
        isSubscriptionOverride: true,
        categoryId: true,
        category: { select: { name: true, icon: true, color: true } },
        bankAccount: {
          select: {
            type: true,
            number: true,
            connectedAccount: { select: { bankName: true, customName: true } },
          },
        },
      },
    });

    type Tx = (typeof txs)[number];
    const grouped = new Map<string, { key: string; isKnown: boolean; amount: number; txs: Tx[] }>();

    for (const tx of txs) {
      const key = subscriptionKey(tx.merchantName, tx.description);
      if (!key) continue;
      const isKnown = isKnownSubscription(key);
      const roundedAmount = Math.round(Math.abs(tx.amount));
      const compositeKey = `${key}|${roundedAmount}`;
      const cur = grouped.get(compositeKey) ?? {
        key,
        isKnown,
        amount: Math.abs(tx.amount),
        txs: [],
      };
      cur.txs.push(tx);
      // mantém o valor mais recente como referência
      cur.amount = Math.abs(tx.amount);
      grouped.set(compositeKey, cur);
    }

    const items: SubscriptionItem[] = [];
    for (const [, g] of grouped) {
      const monthsSet = new Set(g.txs.map((t) => `${t.occurredAt.getUTCFullYear()}-${t.occurredAt.getUTCMonth()}`));

      // Override positivo: se qualquer transação do grupo foi marcada manualmente
      // como assinatura, o grupo passa independente dos critérios algorítmicos.
      const hasForceOn = g.txs.some((t) => t.isSubscriptionOverride === true);
      // Known precisa de só 1 ocorrência. Outros, >= 2 EM MESES DIFERENTES.
      const passes = hasForceOn || (g.isKnown ? g.txs.length >= 1 : monthsSet.size >= 2);
      if (!passes) continue;

      const last = g.txs[g.txs.length - 1];
      const lastDate = last.occurredAt;
      const next = new Date(lastDate);
      next.setDate(next.getDate() + 30);

      const ba = last.bankAccount;
      const conn = ba?.connectedAccount;
      const bankLabel = conn?.customName || conn?.bankName || null;
      const cardSuffix = ba?.type === "CREDIT" && ba?.number ? ` ·${String(ba.number).slice(-4)}` : "";
      const accountName = bankLabel ? `${bankLabel}${cardSuffix}` : null;

      items.push({
        key: g.key,
        label: prettyLabel(last.merchantName, last.description),
        merchantName: last.merchantName,
        averageAmount: round(g.amount),
        occurrences: g.txs.length,
        lastDate: lastDate.toISOString(),
        nextDate: next.toISOString(),
        monthlyAmount: round(g.amount),
        yearlyProjection: round(g.amount * 12),
        recentTransactionIds: g.txs.slice(-3).map((t) => t.id),
        transactionId: last.id,
        accountName,
        categoryId: last.categoryId ?? null,
        categoryName: last.category?.name ?? null,
        categoryIcon: last.category?.icon ?? null,
        categoryColor: last.category?.color ?? null,
        alias: last.alias ?? null,
        isSubscriptionOverride: last.isSubscriptionOverride ?? null,
      });
    }

    // Deduplicar: se o mesmo merchant aparece com valores diferentes (assinatura
    // mudou de preço), mantém a entrada mais recente.
    const byKey = new Map<string, SubscriptionItem>();
    for (const item of items) {
      const existing = byKey.get(item.key);
      if (!existing || new Date(item.lastDate) > new Date(existing.lastDate)) {
        byKey.set(item.key, item);
      }
    }
    const finalItems = [...byKey.values()].sort((a, b) => b.monthlyAmount - a.monthlyAmount);

    const monthlyTotal = round(finalItems.reduce((acc, it) => acc + it.monthlyAmount, 0));
    const yearlyProjection = round(monthlyTotal * 12);
    const averagePerService = finalItems.length === 0 ? 0 : round(monthlyTotal / finalItems.length);

    return {
      items: finalItems,
      totals: { activeCount: finalItems.length, monthlyTotal, yearlyProjection, averagePerService },
    };
  }

  async getCategoryStats(
    userId: string,
    opts: { month?: string; startDate?: string; endDate?: string }
  ): Promise<{ month: string; total: number; items: CategoryStat[] }> {
    let start: Date;
    let end: Date;
    let label: string;

    if (opts.startDate && opts.endDate) {
      start = new Date(opts.startDate);
      // endDate é inclusivo no formato yyyy-MM-dd → adiciona 1 dia pra usar com lt
      end = new Date(opts.endDate);
      end.setUTCDate(end.getUTCDate() + 1);
      label = `${opts.startDate}_${opts.endDate}`;
    } else {
      const month = opts.month!;
      const [year, mon] = month.split("-").map(Number);
      start = new Date(Date.UTC(year, mon - 1, 1));
      end = new Date(Date.UTC(year, mon, 1));
      label = month;
    }

    const txs = await prisma.transaction.findMany({
      where: {
        bankAccount: { connectedAccount: { userId } },
        amount: { lt: 0 },
        // teto = agora: não conta parcelas projetadas no futuro
        occurredAt: { gte: start, lt: end, lte: new Date() },
        categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
      },
      select: {
        amount: true,
        categoryId: true,
        category: { select: { name: true, icon: true, color: true } },
      },
    });

    type Acc = { name: string; icon: string | null; color: string | null; total: number; count: number };
    const map = new Map<string, Acc>();
    let total = 0;
    for (const tx of txs) {
      const id = tx.categoryId ?? "uncategorized";
      const cur = map.get(id) ?? {
        name: tx.category?.name ?? "Sem categoria",
        icon: tx.category?.icon ?? null,
        color: tx.category?.color ?? null,
        total: 0,
        count: 0,
      };
      const abs = Math.abs(tx.amount);
      cur.total += abs;
      cur.count++;
      total += abs;
      map.set(id, cur);
    }

    const items: CategoryStat[] = [...map.entries()]
      .map(([categoryId, c]) => ({
        categoryId,
        categoryName: c.name,
        categoryIcon: c.icon,
        categoryColor: c.color,
        totalSpent: round(c.total),
        transactionsCount: c.count,
        percentage: total > 0 ? round((c.total / total) * 100) : 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);

    return { month: label, total: round(total), items };
  }

  async getInstallments(userId: string): Promise<{ items: InstallmentItem[]; totals: { paid: number; remaining: number; count: number } }> {
    const txs = await prisma.transaction.findMany({
      where: {
        bankAccount: { connectedAccount: { userId } },
        installmentCurrent: { not: null },
        installmentTotal: { not: null },
      },
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        amount: true,
        description: true,
        alias: true,
        merchantName: true,
        installmentCurrent: true,
        installmentTotal: true,
        occurredAt: true,
        categoryId: true,
        isSubscriptionOverride: true,
        category: { select: { name: true, icon: true, color: true } },
        bankAccount: {
          select: {
            type: true,
            number: true,
            marketingName: true,
            name: true,
            connectedAccount: { select: { bankName: true, customName: true } },
          },
        },
      },
    });

    // Agrupa por (description + total): cada compra parcelada vira 1 item.
    const groups = new Map<string, { latest: any; all: any[] }>();
    for (const tx of txs) {
      const norm = (tx.description ?? "").toLowerCase().replace(/\s+\d+\/\d+\s*$/, "").trim();
      const key = `${norm}|${tx.installmentTotal}`;
      const cur = groups.get(key);
      if (!cur || tx.installmentCurrent! > cur.latest.installmentCurrent) {
        groups.set(key, { latest: tx, all: [...(cur?.all ?? []), tx] });
      } else {
        cur.all.push(tx);
      }
    }

    const items: InstallmentItem[] = [];
    let totalPaid = 0;
    let totalRemaining = 0;
    for (const [, { latest, all }] of groups) {
      const total = latest.installmentTotal as number;
      const installmentAmount = Math.abs(latest.amount);

      // "Parcela atual" = MAIOR installmentCurrent entre as parcelas já vencidas
      // (data <= hoje). NÃO é a contagem de linhas no banco: conectores mensais
      // (Nubank) só mandam as parcelas recentes — o Pier tem só 8,9,10 no banco
      // mas já está na 10/12. E NÃO é o installmentCurrent máximo cru: pro
      // Mercado Pago (que manda TODAS as parcelas de uma vez, já espalhadas em
      // datas futuras pelo ingest), as futuras têm data > hoje e não contam.
      const now = Date.now();
      const dueNumbers = all
        .filter((tx) => tx.occurredAt.getTime() <= now)
        .map((tx) => tx.installmentCurrent as number);
      const current = Math.min(Math.max(1, ...dueNumbers), total);

      const totalAmount = round(installmentAmount * total);
      const paidAmount = round(installmentAmount * current);
      const remaining = round(installmentAmount * (total - current));
      const progress = total > 0 ? Math.round((current / total) * 100) : 0;

      // Início (parcela 1): ancora numa parcela conhecida e volta (N-1) meses.
      // Parcela 1 fica na data real da compra; demais no 1º dia do mês. Assim a
      // data certa aparece mesmo quando a parcela 1 não está no banco (Pier).
      const anchor = all.reduce((a, b) => (a.installmentCurrent <= b.installmentCurrent ? a : b));
      const anchorNum = anchor.installmentCurrent as number;
      const ad = anchor.occurredAt as Date;
      const firstDate =
        anchorNum <= 1
          ? ad
          : new Date(Date.UTC(ad.getUTCFullYear(), ad.getUTCMonth() - (anchorNum - 1), 1, 3, 0, 0));
      const monthsLeft = total - current;
      const estimatedLast = new Date(
        Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth() + (total - 1), 1, 3, 0, 0)
      );

      const ba = latest.bankAccount;
      const conn = ba?.connectedAccount;
      const bankLabel = conn?.customName || conn?.bankName || null;
      const cardSuffix = ba?.type === 'CREDIT' && ba?.number ? ` ·${String(ba.number).slice(-4)}` : '';
      const accountName = bankLabel ? `${bankLabel}${cardSuffix}` : null;

      items.push({
        id: latest.id,
        description: stripInstallmentSuffix(latest.description),
        alias: latest.alias ?? null,
        merchantName: latest.merchantName,
        installmentCurrent: current,
        installmentTotal: total,
        installmentAmount: round(installmentAmount),
        totalAmount,
        paidAmount,
        remainingAmount: remaining,
        progress,
        occurredAt: firstDate.toISOString(),
        estimatedLastDate: monthsLeft > 0 ? estimatedLast.toISOString() : null,
        accountName,
        categoryId: latest.categoryId ?? null,
        categoryName: latest.category?.name ?? null,
        categoryIcon: latest.category?.icon ?? null,
        categoryColor: latest.category?.color ?? null,
        isSubscriptionOverride: latest.isSubscriptionOverride ?? null,
      });
      totalPaid += paidAmount;
      totalRemaining += remaining;
    }

    items.sort((a, b) => b.remainingAmount - a.remainingAmount);

    return {
      items,
      totals: { paid: round(totalPaid), remaining: round(totalRemaining), count: items.length },
    };
  }

  /**
   * Resumo dos últimos 7 dias: receitas, despesas, saldo e top categorias de
   * gasto. Usado na tela de resumo e na notificação semanal.
   */
  async getWeeklySummary(userId: string, reference: Date = new Date()): Promise<WeeklySummary> {
    const end = reference;
    const start = new Date(end.getTime() - 7 * 86_400_000);

    const txs = await prisma.transaction.findMany({
      where: {
        bankAccount: { connectedAccount: { userId } },
        occurredAt: { gte: start, lte: end },
        categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
      },
      select: {
        amount: true,
        categoryId: true,
        category: { select: { name: true, icon: true, color: true } },
      },
    });

    let income = 0;
    let expense = 0;
    const catMap = new Map<string, { name: string; icon: string | null; color: string | null; total: number }>();

    for (const tx of txs) {
      if (tx.amount >= 0) {
        income += tx.amount;
      } else {
        const abs = Math.abs(tx.amount);
        expense += abs;
        const id = tx.categoryId ?? "uncategorized";
        const cur = catMap.get(id) ?? {
          name: tx.category?.name ?? "Sem categoria",
          icon: tx.category?.icon ?? null,
          color: tx.category?.color ?? null,
          total: 0,
        };
        cur.total += abs;
        catMap.set(id, cur);
      }
    }

    const topCategories = [...catMap.entries()]
      .map(([categoryId, c]) => ({
        categoryId,
        categoryName: c.name,
        categoryIcon: c.icon,
        categoryColor: c.color,
        total: round(c.total),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      income: round(income),
      expense: round(expense),
      net: round(income - expense),
      count: txs.length,
      topCategories,
    };
  }
}

export interface WeeklySummary {
  startDate: string;
  endDate: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string | null;
    categoryColor: string | null;
    total: number;
  }>;
}

const SUBSCRIPTION_BLACKLIST = [
  "pix enviado",
  "pix recebido",
  "pix pagamento",
  "pix transfer",
  "transferência",
  "transferencia",
  "ted enviada",
  "ted recebida",
  "doc enviado",
  "doc recebido",
  "pagamento cartão",
  "pagamento cartao",
  "pagamento recebido",
  "pagamento de fatura",
  "fatura cartão",
  "fatura cartao",
  "rendimento",
  "estorno",
  "depósito",
  "deposito",
  "saque",
  "compra com pix",
  "qr pix",
  "tarifa",
  "iof",
  "juros",
  "anuidade",
  "tmob",
  "atm",
  "transf",
];

const KNOWN_SUBSCRIPTION_SERVICES = [
  "netflix",
  "spotify",
  "disney",
  "prime video",
  "amazon prime",
  "hbo",
  "globoplay",
  "deezer",
  "youtube",
  "apple music",
  "apple tv",
  "icloud",
  "google one",
  "google drive",
  "microsoft 365",
  "office 365",
  "totalpass",
  "smartfit",
  "smart fit",
  "gympass",
  "linkedin",
  "duolingo",
  "alura",
  "udemy",
  "coursera",
  "claude",
  "chatgpt",
  "openai",
  "tim",
  "vivo",
  "claro",
  "oi",
  "net telecom",
  "sky",
  "directv",
  "twitch",
  "patreon",
  "github",
  "notion",
];

function detectKnownSubscription(text: string): string | null {
  for (const svc of KNOWN_SUBSCRIPTION_SERVICES) {
    if (text.includes(svc)) return svc;
  }
  return null;
}

function isKnownSubscription(key: string): boolean {
  return KNOWN_SUBSCRIPTION_SERVICES.includes(key);
}

function subscriptionKey(merchantName: string | null, description: string): string | null {
  const desc = (description ?? "").toLowerCase();
  const merchant = (merchantName ?? "").toLowerCase().trim();
  const combo = `${desc} ${merchant}`.trim();

  // Se bate com serviço conhecido, sempre inclui (mesmo se houver palavra de blacklist)
  const known = detectKnownSubscription(combo);
  if (known) return known;

  if (SUBSCRIPTION_BLACKLIST.some((bad) => desc.includes(bad))) return null;

  if (merchant.length >= 2) {
    if (SUBSCRIPTION_BLACKLIST.some((bad) => merchant.includes(bad))) return null;
    return merchant;
  }
  const cleaned = desc
    .replace(/\d+/g, " ")
    .replace(/[^a-z\sáéíóúãõçâêô]/gi, " ")
    .split(/\s+/)
    .filter((tok) => tok.length >= 3)
    .slice(0, 3)
    .join(" ");
  return cleaned.length >= 4 ? cleaned : null;
}

function prettyLabel(merchantName: string | null, description: string): string {
  if (merchantName && merchantName.trim().length >= 2) return merchantName;
  return description.length > 40 ? description.slice(0, 40) + "..." : description;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
