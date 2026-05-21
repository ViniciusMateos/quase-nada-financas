import { AccountsRepository } from "../accounts/accounts.repository.js";
import { PluggyClient, PluggyInvestment } from "../../integrations/pluggy.client.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../lib/logger.js";

export interface PortfolioItem {
  id: string;
  name: string;
  assetClass: string;        // "Renda Fixa" | "Fundos" | "Ações" | "FII" | "ETF" | ...
  quantity: number | null;
  investedBrl: number | null;
  currentBrl: number;
  profitBrl: number | null;
  profitPct: number | null;
  dayChangePct: number | null; // valorização desde o último snapshot (vs ontem)
  annualRate: number | null;
  dueDate: string | null;
}

export interface PortfolioGroup {
  source: string;            // nome da instituição (ex: "Rico", "XP")
  items: PortfolioItem[];
  totals: { invested: number; current: number; profit: number };
}

export interface PortfolioVariation {
  dayPct: number | null;
  dayBrl: number | null;
  monthPct: number | null;
  monthBrl: number | null;
}

export interface Portfolio {
  groups: PortfolioGroup[];
  totals: { invested: number; current: number; profit: number };
  byClass: { assetClass: string; current: number }[];
  variation: PortfolioVariation;
}

export interface PortfolioMovement {
  id: string;
  type: string;   // BUY | SELL | TAX | TRANSFER
  date: string | null;
  amount: number;
  quantity: number | null;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Mapeia type/subtype/nome do Pluggy para uma classe amigável em PT-BR. */
function classify(inv: PluggyInvestment): string {
  const name = (inv.name ?? "").toLowerCase();
  const sub = (inv.subtype ?? "").toUpperCase();
  const type = (inv.type ?? "").toUpperCase();

  const ticker = (inv.name ?? "").trim().toUpperCase();
  // FII/FIAGRO: subtype explícito, nome, OU ticker terminando em 11 — o Pluggy
  // às vezes rotula FII/FIAGRO como STOCK (ex: SNAG11 fiagro, GARE11, BTCI11).
  // (Ressalva: ETFs/Units como BOVA11/TAEE11 também terminam em 11.)
  if (
    sub.includes("REAL_ESTATE") ||
    /\bfii\b|fundo imobili|imobili[aá]ri|fiagro|fi-agro/.test(name) ||
    /11$/.test(ticker)
  )
    return "FII";
  if (sub.includes("ETF") || /\betf\b/.test(name)) return "ETF";
  if (sub.includes("TREASURY") || /tesouro/.test(name)) return "Tesouro Direto";

  switch (type) {
    case "FIXED_INCOME": return "Renda Fixa";
    case "MUTUAL_FUND": return "Fundos";
    case "EQUITY": return "Ações";
    case "ETF": return "ETF";
    case "SECURITY": return "Tesouro Direto";
    case "COE": return "COE";
    case "PENSION":
    case "RETIREMENT": return "Previdência";
    default:
      return type ? type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ") : "Outros";
  }
}

function mapItem(inv: PluggyInvestment): PortfolioItem {
  const invested = typeof inv.amount === "number" ? inv.amount : null;
  const current = typeof inv.balance === "number" ? inv.balance : (inv.value ?? 0) * (inv.quantity ?? 0);
  // Lucro só quando há dado real: amountProfit do Pluggy, ou diferença real
  // entre atual e investido. Senão null (não mostra "+0" falso — a XP costuma
  // mandar amount == balance e amountProfit null).
  const profit =
    typeof inv.amountProfit === "number"
      ? inv.amountProfit
      : invested != null && Math.abs(current - invested) > 0.001
        ? current - invested
        : null;
  return {
    id: inv.id,
    name: inv.name || inv.subtype || inv.type || "Ativo",
    assetClass: classify(inv),
    quantity: inv.quantity ?? null,
    investedBrl: invested,
    currentBrl: current,
    profitBrl: profit,
    profitPct: invested && invested > 0 && profit != null ? (profit / invested) * 100 : null,
    dayChangePct: null, // preenchido depois com base no snapshot
    annualRate: inv.annualRate ?? inv.lastTwelveMonthsRate ?? null,
    dueDate: inv.dueDate ?? null,
  };
}

export class PortfolioService {
  private readonly accounts = new AccountsRepository();
  private readonly pluggy = new PluggyClient();

  async getPortfolio(userId: string): Promise<Portfolio> {
    const connected = await this.accounts.findConnectedAccountsByUser(userId);

    const results = await Promise.allSettled(
      connected.map(async (acc) => {
        const investments = await this.pluggy.listInvestments(acc.pluggyItemId);
        return { acc, investments };
      })
    );

    const groups: PortfolioGroup[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") {
        logger.warn({ reason: r.reason }, "Falha ao buscar investimentos de uma conta");
        continue;
      }
      const { acc, investments } = r.value;
      if (investments.length === 0) continue;
      const items = investments.map(mapItem);
      const totals = items.reduce(
        (t, it) => ({
          invested: t.invested + (it.investedBrl ?? 0),
          current: t.current + it.currentBrl,
          profit: t.profit + (it.profitBrl ?? 0),
        }),
        { invested: 0, current: 0, profit: 0 }
      );
      groups.push({ source: acc.customName || acc.bankName, items, totals });
    }

    const totals = groups.reduce(
      (t, g) => ({
        invested: t.invested + g.totals.invested,
        current: t.current + g.totals.current,
        profit: t.profit + g.totals.profit,
      }),
      { invested: 0, current: 0, profit: 0 }
    );

    const byClassMap = new Map<string, number>();
    for (const g of groups) {
      for (const it of g.items) {
        byClassMap.set(it.assetClass, (byClassMap.get(it.assetClass) ?? 0) + it.currentBrl);
      }
    }
    const byClass = [...byClassMap.entries()]
      .map(([assetClass, current]) => ({ assetClass, current }))
      .sort((a, b) => b.current - a.current);

    const variation = await this.snapshotAndComputeVariation(userId, groups, totals.current);

    return { groups, totals, byClass, variation };
  }

  /**
   * Grava a foto de hoje (upsert) e calcula a valorização vs o último dia e vs
   * ~30 dias atrás. Também preenche o dayChangePct de cada item. Como o Pluggy
   * não manda lucro, isso só funciona a partir do histórico que a gente acumula
   * (primeiros dias retornam null).
   */
  private async snapshotAndComputeVariation(
    userId: string,
    groups: PortfolioGroup[],
    totalCurrent: number
  ): Promise<PortfolioVariation> {
    const today = ymd(new Date());
    const assets: Record<string, number> = {};
    for (const g of groups) for (const it of g.items) assets[it.id] = it.currentBrl;

    try {
      await prisma.portfolioSnapshot.upsert({
        where: { userId_date: { userId, date: today } },
        update: { total: totalCurrent, assets },
        create: { userId, date: today, total: totalCurrent, assets },
      });
    } catch (err) {
      logger.warn({ err }, "Falha ao gravar snapshot de portfolio");
    }

    const history = await prisma.portfolioSnapshot.findMany({
      where: { userId, date: { lt: today } },
      orderBy: { date: "desc" },
      take: 45,
    });

    const daySnap = history[0] ?? null;
    const monthCutoff = ymd(new Date(Date.now() - 25 * 86_400_000));
    const monthSnap = history.find((s) => s.date <= monthCutoff) ?? null;

    // Preenche dayChangePct por item.
    if (daySnap) {
      const prev = daySnap.assets as Record<string, number>;
      for (const g of groups) {
        for (const it of g.items) {
          const before = prev?.[it.id];
          it.dayChangePct =
            typeof before === "number" && before > 0 ? ((it.currentBrl - before) / before) * 100 : null;
        }
      }
    }

    const mk = (snap: { total: number } | null) =>
      snap && snap.total > 0
        ? { brl: totalCurrent - snap.total, pct: ((totalCurrent - snap.total) / snap.total) * 100 }
        : null;
    const day = mk(daySnap);
    const month = mk(monthSnap);

    return {
      dayPct: day?.pct ?? null,
      dayBrl: day?.brl ?? null,
      monthPct: month?.pct ?? null,
      monthBrl: month?.brl ?? null,
    };
  }

  /**
   * Movimentos (aportes/resgates) de um investimento. Verifica que o investimento
   * pertence ao usuário antes de devolver.
   */
  async getInvestmentTransactions(userId: string, investmentId: string): Promise<PortfolioMovement[]> {
    const connected = await this.accounts.findConnectedAccountsByUser(userId);
    let owned = false;
    for (const acc of connected) {
      const invs = await this.pluggy.listInvestments(acc.pluggyItemId);
      if (invs.some((i) => i.id === investmentId)) {
        owned = true;
        break;
      }
    }
    if (!owned) return [];

    const txs = await this.pluggy.listInvestmentTransactions(investmentId);
    return txs
      .map((t) => ({
        id: t.id,
        type: (t.type ?? "").toUpperCase(),
        date: t.date ?? null,
        amount: Math.abs(t.amount ?? 0),
        quantity: t.quantity ?? null,
      }))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }
}
