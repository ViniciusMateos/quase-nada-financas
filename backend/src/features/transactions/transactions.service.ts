import { Prisma } from "@prisma/client";
import { TransactionsRepository } from "./transactions.repository.js";
import { Errors } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { MCC_TO_CATEGORY_NAME } from "./mcc-map.js";
import { prisma } from "../../config/database.js";
import { DEFAULT_CATEGORIES, INTERNAL_MOVEMENT_CATEGORY_ID } from "../categories/categories.seed.js";
import { InvestmentsService } from "../investments/investments.service.js";
import type { PluggyTransaction } from "../../integrations/pluggy.client.js";

const SALARY_CATEGORY_ID = "00000000-0000-4000-8000-00000000000E";

export interface ListFilters {
  cursor?: string;
  limit: number;
  accountId?: string;
  accountIds?: string[];
  accountType?: 'BANK' | 'CREDIT';
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
}

interface CursorPayload {
  id: string;
  occurredAt: string;
}

export class TransactionsService {
  private readonly repo = new TransactionsRepository();
  private readonly investments = new InvestmentsService();

  async listTransactions(userId: string, filters: ListFilters) {
    const cursor = decodeCursor(filters.cursor);
    const rows = await this.repo.findTransactionsPage({
      userId,
      limit: filters.limit + 1,
      accountId: filters.accountId,
      accountIds: filters.accountIds,
      accountType: filters.accountType,
      startDate: filters.startDate,
      endDate: filters.endDate,
      categoryId: filters.categoryId,
      cursor,
    });

    let nextCursor: string | null = null;
    if (rows.length > filters.limit) {
      const last = rows.pop()!;
      nextCursor = encodeCursor({ id: last.id, occurredAt: last.occurredAt.toISOString() });
    }

    const items = rows.map((row: any) => ({
      id: row.id,
      accountId: row.bankAccountId,
      accountName: formatBankAccountName(row.bankAccount, row.bankAccount?.connectedAccount),
      accountLogoUrl: row.bankAccount?.connectedAccount?.logoUrl ?? null,
      occurredAt: row.occurredAt.toISOString(),
      description: row.alias ?? stripInstallmentSuffix(row.description),
      originalDescription: row.description,
      alias: row.alias,
      amount: row.amount,
      currency: row.currency,
      paymentMethod: row.paymentMethod,
      installmentCurrent: row.installmentCurrent,
      installmentTotal: row.installmentTotal,
      merchantName: row.merchantName,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? null,
      categoryIcon: row.category?.icon ?? null,
      categoryColor: row.category?.color ?? null,
      isSubscriptionOverride: row.isSubscriptionOverride,
      pending: false,
    }));

    return { items, nextCursor };
  }

  async summary(
    userId: string,
    filters: { startDate?: Date; endDate?: Date; accountId?: string; accountIds?: string[]; accountType?: 'BANK' | 'CREDIT' }
  ): Promise<{ income: number; expense: number; net: number; count: number }> {
    const r = await this.repo.sumByPeriod({
      userId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      accountId: filters.accountId,
      accountIds: filters.accountIds,
      accountType: filters.accountType,
    });
    return {
      income: round2(r.income),
      expense: round2(r.expense),
      net: round2(r.income - r.expense),
      count: r.count,
    };
  }

  async listSimilar(userId: string, transactionId: string) {
    const tx = await this.repo.findTransactionByIdForUser(userId, transactionId);
    if (!tx) throw Errors.NotFound("Transação não encontrada");
    const rows = await this.repo.findSimilarTransactions(
      userId,
      transactionId,
      tx.merchantName,
      tx.description,
      10
    );
    return rows.map((row: any) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      amount: row.amount,
      description: row.description,
      categoryName: row.category?.name ?? null,
      categoryIcon: row.category?.icon ?? null,
      accountName: formatBankAccountName(row.bankAccount, row.bankAccount?.connectedAccount),
    }));
  }

  /**
   * Reprocessa categoryId de todas as transactions do user usando as regras atuais.
   * Útil após mudança no KEYWORD_RULES ou no MCC_TO_CATEGORY_NAME.
   */
  async recategorizeAll(userId: string): Promise<{ updated: number; total: number }> {
    const all = await this.repo.findAllTransactionsByUser(userId);
    const userRules = await this.repo.findCategoryRulesByUser(userId);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { selfName: true } });
    const selfName = user?.selfName ?? null;
    let updated = 0;
    for (const tx of all) {
      const ptx = {
        id: tx.externalId,
        date: tx.occurredAt.toISOString(),
        amount: tx.amount,
        currencyCode: tx.currency,
        description: tx.description,
        merchant: { name: tx.merchantName ?? undefined, mcc: tx.merchantMcc ?? undefined },
      } as PluggyTransaction;
      const newCategoryId = await this.resolveCategoryId(userId, ptx, userRules, selfName);
      if (newCategoryId && newCategoryId !== tx.categoryId) {
        await this.repo.updateTransactionCategory(tx.id, newCategoryId);
        updated++;
      }
    }
    return { updated, total: all.length };
  }

  async updateCategory(
    userId: string,
    transactionId: string,
    categoryId: string,
    createRule: boolean
  ) {
    const tx = await this.repo.findTransactionByIdForUser(userId, transactionId);
    if (!tx) throw Errors.NotFound("Transação não encontrada");

    const category = await this.repo.findCategoryForUser(userId, categoryId);
    if (!category) throw Errors.NotFound("Categoria não encontrada");

    const updated = await this.repo.updateTransactionCategory(transactionId, categoryId);

    if (createRule && tx.merchantName) {
      await this.repo.createCategoryRule({
        userId,
        merchantNamePattern: tx.merchantName.toLowerCase(),
        mcc: tx.merchantMcc ?? null,
        categoryId,
        priority: 10,
      });
    }

    return updated;
  }

  /**
   * Update genérico de transação: descrição (via alias), categoria e flag de
   * assinatura. Quando algum desses campos muda, propaga automaticamente pra
   * todas as transações similares do user (mesmo merchant, ou mesma descrição
   * normalizada se merchant=null).
   *
   * Para mudança de categoria, também cria uma CategoryRule pra futuras
   * transações desse merchant caírem na nova categoria automaticamente.
   */
  async updateTransaction(
    userId: string,
    transactionId: string,
    body: {
      alias?: string | null;
      categoryId?: string;
      isSubscriptionOverride?: boolean | null;
    }
  ): Promise<{ updated: any; affectedSimilar: number }> {
    const tx = await this.repo.findTransactionByIdForUser(userId, transactionId);
    if (!tx) throw Errors.NotFound("Transação não encontrada");

    const data: { alias?: string | null; categoryId?: string; isSubscriptionOverride?: boolean | null } = {};
    if (body.alias !== undefined) {
      const trimmed = body.alias === null ? null : body.alias.trim();
      data.alias = trimmed === "" ? null : trimmed;
    }
    if (body.categoryId !== undefined) {
      const category = await this.repo.findCategoryForUser(userId, body.categoryId);
      if (!category) throw Errors.NotFound("Categoria não encontrada");
      data.categoryId = body.categoryId;
    }
    if (body.isSubscriptionOverride !== undefined) {
      data.isSubscriptionOverride = body.isSubscriptionOverride;
    }

    if (Object.keys(data).length === 0) {
      return { updated: tx, affectedSimilar: 0 };
    }

    const updated = await this.repo.updateTransactionFields(transactionId, data);

    // Propaga pra similares
    const affectedSimilar = await this.repo.updateSimilarTransactions(
      userId,
      transactionId,
      { merchantName: tx.merchantName, description: tx.description },
      data
    );

    // Se a categoria mudou, criar CategoryRule pra futuras transações desse
    // merchant entrarem na nova categoria automaticamente (mesmo comportamento
    // do updateCategory com createRule=true).
    if (data.categoryId && tx.merchantName) {
      await this.repo.createCategoryRule({
        userId,
        merchantNamePattern: tx.merchantName.toLowerCase(),
        mcc: tx.merchantMcc ?? null,
        categoryId: data.categoryId,
        priority: 10,
      });
    }

    return { updated, affectedSimilar };
  }

  /**
   * Insere transações vindas do Pluggy aplicando categorização automática
   * pela ordem: 1) regras do usuário, 2) MCC → categoria padrão.
   */
  async ingestTransactions(
    userId: string,
    bankAccountId: string,
    pluggyTxs: PluggyTransaction[]
  ): Promise<number> {
    if (pluggyTxs.length === 0) return 0;

    const userRules = await this.repo.findCategoryRulesByUser(userId);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { selfName: true } });
    const selfName = user?.selfName ?? null;

    let inserted = 0;
    for (const ptx of pluggyTxs) {
      const exists = await this.repo.findTransactionByExternalId(bankAccountId, ptx.id);
      if (exists) continue;

      const categoryId = await this.resolveCategoryId(userId, ptx, userRules, selfName);
      const normalizedAmount = normalizeAmountSign(ptx);

      await this.repo.createTransaction({
        bankAccountId,
        externalId: ptx.id,
        amount: normalizedAmount,
        currency: ptx.currencyCode ?? "BRL",
        description: ptx.description ?? "",
        merchantName: ptx.merchant?.name ?? null,
        merchantMcc: ptx.merchant?.mcc ?? null,
        paymentMethod: ptx.paymentData?.paymentMethod ?? null,
        occurredAt: installmentOccurredAt(ptx),
        installmentCurrent: ptx.creditCardMetadata?.installmentNumber ?? null,
        installmentTotal: ptx.creditCardMetadata?.totalInstallments ?? null,
        categoryId,
        rawData: ptx as unknown as Prisma.InputJsonValue,
      });
      inserted++;

      // Trigger event: salário recebido → cria pending actions das regras
      if (categoryId === SALARY_CATEGORY_ID && normalizedAmount > 0) {
        this.investments.onSalaryReceived(userId, normalizedAmount).catch((err) => {
          logger.error({ err, userId, txId: ptx.id }, "Erro ao processar trigger salary_received");
        });
      }
    }

    return inserted;
  }

  private async resolveCategoryId(
    _userId: string,
    ptx: PluggyTransaction,
    userRules: Array<{
      merchantNamePattern: string | null;
      mcc: string | null;
      categoryId: string;
      priority: number;
    }>,
    selfName: string | null = null
  ): Promise<string | null> {
    const merchantName = ptx.merchant?.name?.toLowerCase() ?? "";
    const mcc = ptx.merchant?.mcc ?? null;
    const description = (ptx.description ?? "").toLowerCase();

    // 0) movimentação interna: cofrinho/reserva do MP, caixinha RDB do Nubank,
    //    aplicação/resgate/rendimento dessas reservas, E PIX/transferência pra si
    //    mesmo. Dinheiro que só troca de lugar — categoria excluída de saldo,
    //    gastos, receitas e da lista. Prioridade máxima.
    if (INTERNAL_MOVEMENT_RE.test(description) || isSelfTransfer(ptx.description ?? "", selfName)) {
      return INTERNAL_MOVEMENT_CATEGORY_ID;
    }

    // 1) regras do usuário (prioridade desc)
    const sortedRules = [...userRules].sort((a, b) => b.priority - a.priority);
    for (const rule of sortedRules) {
      if (rule.merchantNamePattern && merchantName.includes(rule.merchantNamePattern)) {
        return rule.categoryId;
      }
      if (rule.mcc && mcc && rule.mcc === mcc) {
        return rule.categoryId;
      }
    }

    // 2) MCC → categoria padrão
    if (mcc) {
      const categoryName = MCC_TO_CATEGORY_NAME[mcc];
      if (categoryName) {
        const cat = DEFAULT_CATEGORIES.find((c) => c.name === categoryName);
        if (cat) return cat.id;
      }
    }

    // 3) keyword matching no description + merchant
    const haystack = `${description} ${merchantName}`;
    const matched = matchByKeywords(haystack);
    if (matched) {
      const cat = DEFAULT_CATEGORIES.find((c) => c.name === matched);
      if (cat) return cat.id;
    }

    // 4) fallback: categoria "Outros"
    const fallback = DEFAULT_CATEGORIES.find((c) => c.name === "Outros");
    return fallback?.id ?? null;
  }
}

/**
 * Movimentação interna (dinheiro que só muda de lugar, não é gasto/receita):
 *   - MP: "Dinheiro reservado ...", "Dinheiro resgatado ..." (cofrinho/reservas)
 *   - Nubank: "Aplicação RDB" / "Resgate RDB" (caixinha RDB)
 *   - "Rendimentos" exato = rendimento do cofrinho MP (NÃO pega "Rendimentos de
 *     clientes XPSF11" dos FIIs, que tem mais texto).
 * "reserva" sozinho NÃO entra (senão pega "Reserva Cultural" = restaurante real).
 */
// Movimento interno = dinheiro só trocando de lugar (reserva/caixinha). O
// RENDIMENTO do cofrinho NÃO entra aqui de propósito: é ganho de verdade e cai
// em "Investimentos" (conta como receita).
const INTERNAL_MOVEMENT_RE = /\brdb\b|dinheiro (reservado|resgatado|retirado|devolvido|disponibilizado)/i;

// Remove acento e minúsculo (pra casar nome do titular com a descrição).
function stripAccentsLower(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
// Descrição parece uma transferência/pix (não uma compra)?
const TRANSFER_RE = /transfer|pix|\bted\b|\bdoc\b|enviad|recebid/i;
/**
 * PIX/transferência pra si mesmo: a descrição parece transferência E contém
 * TODOS os tokens significativos (>=3 letras, sem "de/da/do") do nome do titular.
 * Ex.: titular "Vinicius de Souza Mateos" casa "Pix enviado Vinicius de Souza
 * Mateos" mas NÃO "Pix enviado Julia de Souza Mateos" (falta "vinicius").
 */
function isSelfTransfer(description: string, selfName: string | null): boolean {
  if (!selfName) return false;
  if (!TRANSFER_RE.test(description)) return false;
  const desc = stripAccentsLower(description);
  const tokens = stripAccentsLower(selfName)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !["de", "da", "do", "dos", "das"].includes(t));
  return tokens.length > 0 && tokens.every((t) => desc.includes(t));
}

const KEYWORD_RULES: Array<{ category: string; keywords: string[] }> = [
  // Pagamento de fatura é prioritário pra não cair em "Tarifas"
  { category: "Pagamento de fatura", keywords: ["pagamento cartão", "pagamento cartao", "pagamento de fatura", "pagamento recebido", "fatura cartão", "fatura cartao"] },
  { category: "Investimentos", keywords: ["rendiment", "cdb", "tesouro", "cri ", "cra ", "fundo "] },
  { category: "Tarifas", keywords: ["iof", "anuidade", "juros", "tarifa", "estorno"] },
  { category: "Mercado", keywords: ["mercado ", "supermercado", "atacad", "carrefour", "extra ", "pão de açúcar", "pao de acucar", "dia ", "assaí", "assai", "verdurão", "hortifruti"] },
  { category: "Restaurantes", keywords: ["restaurant", "lanchon", "burger", "mc donalds", "mcdonalds", "subway", "pizza", "ifood", "rappi", "uber eats", "bar ", "cafeteria", "starbucks", "brigadeiro", "padaria", "doceria", "sorveteria"] },
  { category: "Transporte", keywords: ["uber", "99 ", "99app", "99 ", "cabify", "blablacar", "posto ", "shell", "ipiranga", "ale ", "br mania", "estacionament", "pedagio", "pedágio", "metro ", "metrô"] },
  { category: "Lazer", keywords: ["netflix", "spotify", "disney", "prime video", "amazon prime", "hbo", "globoplay", "deezer", "youtube premium", "apple music", "apple tv"] },
  { category: "Serviços", keywords: ["tim ", "vivo ", "claro ", "oi ", "net ", "internet", "assinatura"] },
  { category: "Saúde", keywords: ["farmacia", "farmácia", "drogaria", "drogasil", "raia", "pacheco", "ikesaki", "hospital", "clinica", "clínica", "laboratorio", "laboratório", "consulta médica", "consulta medica", "dentista"] },
  { category: "Moradia", keywords: ["aluguel", "condominio", "condomínio", "energia", "enel", "cpfl", "elektro", "agua", "água", "sabesp", "gas ", "gás", "iptu"] },
  { category: "Educação", keywords: ["escola", "faculdade", "universidade", "curso", "livro ", "livraria", "alura", "udemy", "coursera"] },
  { category: "Lazer", keywords: ["cinema", "ingresso", "show ", "festa", "balada", "parque", "academia", "smart fit", "smartfit", "passeio"] },
  { category: "Compras", keywords: ["mercado livre", "amazon", "shopee", "aliexpress", "americanas", "magalu", "magazine luiza", "casas bahia", "renner", "riachuelo", "loja "] },
  { category: "Vestuário", keywords: ["zara", "c&a", "nike", "adidas", "centauro", "decathlon", "tenis", "tênis", "calçad", "calcad"] },
  { category: "Salário", keywords: ["salario", "salário", "pagamento de salário", "pagamento salario", "folha de pag"] },
];

function matchByKeywords(text: string): string | null {
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) return rule.category;
    }
  }
  return null;
}

/**
 * Pluggy/conectores às vezes retornam amount com sinal inconsistente com o
 * tipo da transação (ex: TIM POS vem +55 mas type=DEBIT). Normaliza usando
 * o type como fonte da verdade:
 *   DEBIT  → amount negativo (saída de dinheiro)
 *   CREDIT → amount positivo (entrada de dinheiro)
 * Se o type não vier, mantém o sinal original.
 */
/**
 * Data em que a parcela cai. Alguns conectores (Mercado Pago cartão) mandam
 * TODAS as N parcelas de uma compra com a MESMA data (a da compra), inflando o
 * mês. Projetamos cada parcela no mês em que será cobrada:
 *   - Parcela 1 (ou transação sem parcelamento): data real da compra.
 *   - Parcela N>1: primeiro dia do mês = (mês da compra) + (N-1) meses.
 * Assim cada mês mostra só a sua parcela, e a tela de Parcelamentos consegue
 * dizer quais já passaram (data <= hoje) vs futuras.
 */
function installmentOccurredAt(ptx: PluggyTransaction): Date {
  const meta = ptx.creditCardMetadata;
  const base = new Date(ptx.date);
  const total = meta?.totalInstallments;
  const num = meta?.installmentNumber;
  if (!total || total <= 1 || !num || num <= 1) return base;
  const purchase = meta?.purchaseDate ? new Date(meta.purchaseDate) : base;
  // 03:00 UTC = meia-noite no horário de Brasília (UTC-3). Assim a data exibida
  // é o dia 1, E a parcela só "passa a valer" (occurredAt <= agora) exatamente
  // quando vira o dia 1 em Brasília — não antes. Meia-noite UTC apareceria no
  // último dia do mês anterior em BRT (bug que mostrava a parcela 2 em 31/05).
  return new Date(Date.UTC(purchase.getUTCFullYear(), purchase.getUTCMonth() + (num - 1), 1, 3, 0, 0));
}

/**
 * Remove o sufixo de parcela do nome ("Pier 10/12" → "Pier"). O número da
 * parcela já aparece no badge "10/12" e no "Parcela X/Y", então no nome é
 * redundante. Só mexe quando o final é exatamente " N/N".
 */
export function stripInstallmentSuffix(desc: string | null | undefined): string {
  return (desc ?? "").replace(/\s+\d+\s*\/\s*\d+\s*$/, "").trim();
}

function normalizeAmountSign(ptx: PluggyTransaction & { type?: string }): number {
  const raw = ptx.amount;
  const type = (ptx as any).type;
  if (type === "DEBIT") return -Math.abs(raw);
  if (type === "CREDIT") return Math.abs(raw);
  return raw;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function shortBankSubtype(subtype?: string | null): string {
  switch (subtype) {
    case 'CHECKING_ACCOUNT': return 'Conta corrente';
    case 'SAVINGS_ACCOUNT': return 'Poupança';
    case 'PREPAID_ACCOUNT': return 'Conta pré-paga';
    case 'PAYMENT_ACCOUNT': return 'Conta de pagamento';
    default: return 'Conta';
  }
}

function formatBankAccountName(
  bankAccount?: { name?: string | null; marketingName?: string | null; number?: string | null; type?: string | null; subtype?: string | null } | null,
  connected?: { bankName?: string | null; customName?: string | null } | null
): string | null {
  if (!bankAccount && !connected) return null;
  const connectorLabel = connected?.customName || connected?.bankName || null;
  const isCredit = bankAccount?.type === 'CREDIT';
  const baseAccountLabel = isCredit
    ? 'Cartão'
    : shortBankSubtype(bankAccount?.subtype);
  const number = bankAccount?.number;
  const suffix = isCredit && number ? ` ·${String(number).slice(-4)}` : '';

  if (connectorLabel) {
    return `${connectorLabel} · ${baseAccountLabel}${suffix}`;
  }
  return `${baseAccountLabel}${suffix}`;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): CursorPayload | undefined {
  if (!cursor) return undefined;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as CursorPayload;
    if (!parsed.id || !parsed.occurredAt) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
