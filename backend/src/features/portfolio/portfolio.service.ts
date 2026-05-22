import { AccountsRepository } from "../accounts/accounts.repository.js";
import { PluggyClient, PluggyInvestment } from "../../integrations/pluggy.client.js";
import { MarketClient } from "../../integrations/market.client.js";
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
  dayChangeBrl: number | null; // variação em R$ no dia (pra somar no total da carteira)
  monthChangePct: number | null; // valorização vs ~30 dias atrás
  monthChangeBrl: number | null; // variação em R$ vs ~30 dias atrás
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Ticker B3: 4 letras + 1-2 dígitos. Classes que são negociadas em bolsa.
const TICKER_RE = /^[A-Z]{4}\d{1,2}$/;
const TRADED_CLASSES = new Set(["FII", "Ações", "ETF"]);

/** Extrai o ticker B3 de um investimento (code tem prioridade sobre name). */
function tickerOf(inv: PluggyInvestment): string | null {
  for (const cand of [inv.code, inv.name]) {
    const t = (cand ?? "").trim().toUpperCase();
    if (TICKER_RE.test(t)) return t;
  }
  return null;
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
    dayChangePct: null, // preenchido depois (cotação ao vivo ou snapshot)
    dayChangeBrl: null,
    monthChangePct: null,
    monthChangeBrl: null,
    annualRate: inv.annualRate ?? inv.lastTwelveMonthsRate ?? null,
    dueDate: inv.dueDate ?? null,
  };
}

/**
 * Junta itens de mesmo nome+classe numa posição só. A caixinha do Nubank, por
 * exemplo, vem como dezenas de CDBs idênticos (um por aporte/vencimento) — sem
 * isso a aba Ativos fica poluída. O `id` do item agrupado vira a lista de ids
 * dos filhos separada por vírgula, pra o endpoint de transações trazer os
 * aportes de todos juntos.
 */
function mergeSameName(items: PortfolioItem[]): PortfolioItem[] {
  const groups = new Map<string, PortfolioItem[]>();
  const order: string[] = [];
  for (const it of items) {
    const key = `${it.name}|${it.assetClass}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(it);
  }
  return order.map((key) => {
    const g = groups.get(key)!;
    return g.length === 1 ? g[0] : mergeGroup(g);
  });
}

function mergeGroup(g: PortfolioItem[]): PortfolioItem {
  const sumOf = (f: (it: PortfolioItem) => number | null) =>
    g.reduce((acc, it) => acc + (f(it) ?? 0), 0);
  const anyOf = (f: (it: PortfolioItem) => number | null) => g.some((it) => f(it) != null);

  const current = sumOf((it) => it.currentBrl);
  const invested = anyOf((it) => it.investedBrl) ? sumOf((it) => it.investedBrl) : null;
  const profit = anyOf((it) => it.profitBrl) ? sumOf((it) => it.profitBrl) : null;
  const dayBrl = anyOf((it) => it.dayChangeBrl) ? sumOf((it) => it.dayChangeBrl) : null;
  const monthBrl = anyOf((it) => it.monthChangeBrl) ? sumOf((it) => it.monthChangeBrl) : null;
  const prevDay = current - (dayBrl ?? 0);
  const prevMonth = current - (monthBrl ?? 0);

  const first = g[0];
  // A caixinha do Nubank é lastreada em CDBs da NU FINANCEIRA — rótulo amigável.
  const name = /nu financeira/i.test(first.name) ? "Caixinha Nubank" : first.name;

  return {
    id: g.map((it) => it.id).join(","),
    name,
    assetClass: first.assetClass,
    quantity: null,
    investedBrl: invested != null ? round2(invested) : null,
    currentBrl: round2(current),
    profitBrl: profit != null ? round2(profit) : null,
    profitPct: invested && invested > 0 && profit != null ? round2((profit / invested) * 100) : null,
    dayChangePct: dayBrl != null && prevDay > 0 ? round2((dayBrl / prevDay) * 100) : null,
    dayChangeBrl: dayBrl != null ? round2(dayBrl) : null,
    monthChangePct: monthBrl != null && prevMonth > 0 ? round2((monthBrl / prevMonth) * 100) : null,
    monthChangeBrl: monthBrl != null ? round2(monthBrl) : null,
    annualRate: first.annualRate,
    dueDate: null,
  };
}

export class PortfolioService {
  private readonly accounts = new AccountsRepository();
  private readonly pluggy = new PluggyClient();
  private readonly market = new MarketClient();

  async getPortfolio(userId: string): Promise<Portfolio> {
    const connected = await this.accounts.findConnectedAccountsByUser(userId);

    const results = await Promise.allSettled(
      connected.map(async (acc) => {
        const investments = await this.pluggy.listInvestments(acc.pluggyItemId);
        return { acc, investments };
      })
    );

    // Monta os itens e guarda o ticker B3 de cada um (id -> ticker) pra cotar.
    const rawGroups: { source: string; items: PortfolioItem[] }[] = [];
    const tickerById = new Map<string, string>();
    for (const r of results) {
      if (r.status !== "fulfilled") {
        logger.warn({ reason: r.reason }, "Falha ao buscar investimentos de uma conta");
        continue;
      }
      const { acc, investments } = r.value;
      if (investments.length === 0) continue;
      // Ignora posições zeradas: a caixinha do Nubank, por exemplo, volta
      // dezenas de CDBs antigos já resgatados (quantity/balance = 0), que só
      // sujariam a lista. Só entra quem tem valor de verdade.
      const items = investments.map(mapItem).filter((it) => it.currentBrl > 0.005);
      if (items.length === 0) continue;
      for (const inv of investments) {
        const t = tickerOf(inv);
        if (t) tickerById.set(inv.id, t);
      }
      rawGroups.push({ source: acc.customName || acc.bankName, items });
    }

    // Cotação B3 ao vivo: preço de mercado × quantidade vira o valor atual e o
    // fechamento anterior dá a variação real do dia (a Pluggy só manda valor
    // congelado da última sincronização). Renda fixa/fundos seguem via Pluggy.
    await this.enrichWithMarketQuotes(rawGroups, tickerById);

    const groups: PortfolioGroup[] = rawGroups.map((g) => ({
      source: g.source,
      items: g.items,
      totals: g.items.reduce(
        (t, it) => ({
          invested: t.invested + (it.investedBrl ?? 0),
          current: t.current + it.currentBrl,
          profit: t.profit + (it.profitBrl ?? 0),
        }),
        { invested: 0, current: 0, profit: 0 }
      ),
    }));

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

    // Junta posições de mesmo nome numa linha só (ex: a caixinha do Nubank vem
    // como dezenas de CDBs iguais). Feito por último pra não atrapalhar cotação
    // e snapshot, que trabalham por id individual.
    for (const g of groups) g.items = mergeSameName(g.items);

    return { groups, totals, byClass, variation };
  }

  /**
   * Cota os ativos negociados em bolsa (FII/ações/ETF) no Yahoo e sobrescreve
   * o valor atual com preço de mercado × quantidade, além de preencher o
   * dayChangePct com a variação real do dia. Falhas são silenciosas: o item
   * mantém o valor que veio da Pluggy.
   */
  private async enrichWithMarketQuotes(
    groups: { source: string; items: PortfolioItem[] }[],
    tickerById: Map<string, string>
  ): Promise<void> {
    const tickers: string[] = [];
    for (const g of groups) {
      for (const it of g.items) {
        const t = tickerById.get(it.id);
        if (t && TRADED_CLASSES.has(it.assetClass) && it.quantity != null) tickers.push(t);
      }
    }
    if (tickers.length === 0) return;

    const quotes = await this.market.getQuotes(tickers);
    if (quotes.size === 0) return;

    for (const g of groups) {
      for (const it of g.items) {
        const t = tickerById.get(it.id);
        const q = t ? quotes.get(t) : undefined;
        if (q && it.quantity != null) {
          it.currentBrl = round2(q.price * it.quantity);
          it.dayChangePct = round2(q.changePct);
          it.dayChangeBrl = round2((q.price - q.previousClose) * it.quantity);
          // Recalcula o lucro contra o valor de mercado vivo (o mapItem usou o
          // valor congelado da Pluggy, que costuma vir balance == amount = 0 lucro).
          if (it.investedBrl != null && it.investedBrl > 0) {
            it.profitBrl = round2(it.currentBrl - it.investedBrl);
            it.profitPct = round2((it.profitBrl / it.investedBrl) * 100);
          }
        }
      }
    }
  }

  /**
   * Grava a foto de hoje (upsert) e calcula a valorização vs o último dia e vs
   * ~30 dias atrás. A variação do dia vem do dayChangePct ao vivo dos ativos
   * (Yahoo); o snapshot serve de fallback e como base do retorno do mês.
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

    // Preenche dayChangePct/Brl só dos itens que ainda não têm cotação ao vivo
    // (renda fixa/fundos), usando o snapshot de ontem.
    if (daySnap) {
      const prev = daySnap.assets as Record<string, number>;
      for (const g of groups) {
        for (const it of g.items) {
          if (it.dayChangePct != null) continue;
          const before = prev?.[it.id];
          if (typeof before === "number" && before > 0) {
            it.dayChangeBrl = round2(it.currentBrl - before);
            it.dayChangePct = round2(((it.currentBrl - before) / before) * 100);
          }
        }
      }
    }

    // Valorização do mês por item, comparando com o snapshot de ~30 dias atrás.
    if (monthSnap) {
      const prev = monthSnap.assets as Record<string, number>;
      for (const g of groups) {
        for (const it of g.items) {
          const before = prev?.[it.id];
          if (typeof before === "number" && before > 0) {
            it.monthChangeBrl = round2(it.currentBrl - before);
            it.monthChangePct = round2(((it.currentBrl - before) / before) * 100);
          }
        }
      }
    }

    // Variação do dia da carteira a partir do dayChangePct de cada item:
    // recupera o valor de ontem (cur / (1 + pct)) e soma. Itens sem variação
    // entram com valor neutro. É o número consistente com os badges "hoje".
    let dayBrlLive = 0;
    let prevTotalLive = 0;
    let hasLiveDay = false;
    for (const g of groups) {
      for (const it of g.items) {
        if (typeof it.dayChangePct === "number") {
          const before = it.currentBrl / (1 + it.dayChangePct / 100);
          dayBrlLive += it.currentBrl - before;
          prevTotalLive += before;
          hasLiveDay = true;
        } else {
          prevTotalLive += it.currentBrl;
        }
      }
    }

    const mk = (snap: { total: number } | null) =>
      snap && snap.total > 0
        ? { brl: totalCurrent - snap.total, pct: ((totalCurrent - snap.total) / snap.total) * 100 }
        : null;
    const daySnapVar = mk(daySnap);
    const day =
      hasLiveDay && prevTotalLive > 0
        ? { brl: dayBrlLive, pct: (dayBrlLive / prevTotalLive) * 100 }
        : daySnapVar;
    const month = mk(monthSnap);

    return {
      dayPct: day ? round2(day.pct) : null,
      dayBrl: day ? round2(day.brl) : null,
      monthPct: month ? round2(month.pct) : null,
      monthBrl: month ? round2(month.brl) : null,
    };
  }

  /**
   * Movimentos (aportes/resgates) de um ou mais investimentos. Aceita ids
   * separados por vírgula (uma posição agrupada, ex: a caixinha do Nubank,
   * carrega os ids de todos os CDBs). Verifica posse antes de devolver e junta
   * os movimentos de todos, ordenados por data.
   */
  async getInvestmentTransactions(userId: string, idParam: string): Promise<PortfolioMovement[]> {
    const requested = idParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (requested.length === 0) return [];

    const connected = await this.accounts.findConnectedAccountsByUser(userId);
    const ownedIds = new Set<string>();
    for (const acc of connected) {
      const invs = await this.pluggy.listInvestments(acc.pluggyItemId);
      for (const i of invs) ownedIds.add(i.id);
    }
    const ids = requested.filter((id) => ownedIds.has(id));
    if (ids.length === 0) return [];

    const lists = await Promise.all(ids.map((id) => this.pluggy.listInvestmentTransactions(id)));
    return lists
      .flat()
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
