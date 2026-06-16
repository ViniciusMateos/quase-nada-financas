import type { Account, BankAccount } from '@/types/api.types';

/**
 * Logos SVG dos bancos via repositório público github.com/Tgentil/Bancos-em-SVG.
 * Cada banco tem 2 variantes:
 *   - filled: logo COM o fundo colorido do banco (ex: Nubank roxo cheio).
 *             Usado em bolinhas grandes (Contas, Início).
 *   - inline: logo transparente, geralmente o símbolo isolado.
 *             Usado em rótulos pequenos (linha da conta nas transações).
 *
 * O BankBadge já tem o proxy weserv que converte SVG→PNG sob demanda.
 */
const RAW = 'https://raw.githubusercontent.com/Tgentil/Bancos-em-SVG/main';

const BANK_LOGOS: Record<string, { filled: string; inline: string }> = {
  'Nubank': {
    filled: `${RAW}/Nu%20Pagamentos%20S.A/nubank-logo-fundo-roxo2021.svg`,
    inline: `${RAW}/Nu%20Pagamentos%20S.A/nubank-logo-2021.svg`,
  },
  'Mercado Pago': {
    filled: `${RAW}/Mercado%20Pago/mercado-pago.svg`,
    inline: `${RAW}/Mercado%20Pago/mercado-pago.svg`,
  },
  'Itaú': {
    // Logo nova (squircle laranja com letras brancas, cantos transparentes).
    // A antiga `itau.svg` vinha com um quadrado branco de fundo que ficava feio
    // no tema escuro; esta é self-contained e limpa em claro/escuro.
    filled: `${RAW}/Ita%C3%BA%20Unibanco%20S.A/logo-nova-letras-brancas.svg`,
    inline: `${RAW}/Ita%C3%BA%20Unibanco%20S.A/logo-nova-letras-brancas.svg`,
  },
  'Bradesco': {
    filled: `${RAW}/Bradesco%20S.A/bradesco.svg`,
    inline: `${RAW}/Bradesco%20S.A/bradesco.svg`,
  },
  'Santander': {
    filled: `${RAW}/Banco%20Santander%20Brasil%20S.A/santander-fundo-vermelho.svg`,
    inline: `${RAW}/Banco%20Santander%20Brasil%20S.A/banco-santander-logo.svg`,
  },
  'Banco do Brasil': {
    filled: `${RAW}/Banco%20do%20Brasil%20S.A/banco-do-brasil-com-fundo.svg`,
    inline: `${RAW}/Banco%20do%20Brasil%20S.A/banco-do-brasil-sem-fundo.svg`,
  },
  'Caixa': {
    filled: `${RAW}/Caixa%20Econ%C3%B4mica%20Federal/caixa-economica-federal-1.svg`,
    inline: `${RAW}/Caixa%20Econ%C3%B4mica%20Federal/caixa-economica-federal-X.svg`,
  },
  'Inter': {
    filled: `${RAW}/Banco%20Inter%20S.A/inter.svg`,
    inline: `${RAW}/Banco%20Inter%20S.A/inter.svg`,
  },
  'C6': {
    filled: `${RAW}/Banco%20C6%20S.A/c6%20bank.svg`,
    inline: `${RAW}/Banco%20C6%20S.A/c6%20bank.svg`,
  },
  'PicPay': {
    filled: `${RAW}/PicPay/Logo-PicPay.svg`,
    inline: `${RAW}/PicPay/Logo-PicPay.svg`,
  },
  'PagBank': {
    filled: `${RAW}/PagSeguro%20Internet%20S.A/logo-pagbank.svg`,
    inline: `${RAW}/PagSeguro%20Internet%20S.A/logo-pagbank.svg`,
  },
  'BTG Pactual': {
    filled: `${RAW}/Banco%20BTG%20Pacutal/btg-pactual.svg`,
    inline: `${RAW}/Banco%20BTG%20Pacutal/btg-pactual.svg`,
  },
  'XP': {
    filled: `${RAW}/XP%20Investimentos/xp-investimentos-logo.svg`,
    inline: `${RAW}/XP%20Investimentos/xp-investimentos-logo.svg`,
  },
  'Safra': {
    filled: `${RAW}/Banco%20Safra%20S.A/logo-safra.svg`,
    inline: `${RAW}/Banco%20Safra%20S.A/logo-safra.svg`,
  },
};

// Aliases comuns vindos do Pluggy ("Nu Pagamentos S/A", "Banco Inter S/A"...)
// mapeados pra chave canônica em BANK_LOGOS.
const NAME_ALIASES: Array<{ match: RegExp; key: string }> = [
  { match: /nu pagamentos|nubank/i, key: 'Nubank' },
  { match: /mercado pago/i, key: 'Mercado Pago' },
  { match: /ita[uú]/i, key: 'Itaú' },
  { match: /bradesco/i, key: 'Bradesco' },
  { match: /santander/i, key: 'Santander' },
  { match: /banco do brasil|\bbb\b/i, key: 'Banco do Brasil' },
  { match: /caixa/i, key: 'Caixa' },
  { match: /\binter\b/i, key: 'Inter' },
  { match: /\bc6\b/i, key: 'C6' },
  { match: /pic ?pay/i, key: 'PicPay' },
  { match: /pag ?bank|pagseguro/i, key: 'PagBank' },
  { match: /btg/i, key: 'BTG Pactual' },
  { match: /\bxp\b/i, key: 'XP' },
  { match: /safra/i, key: 'Safra' },
];

/**
 * Identifica a chave canônica em BANK_LOGOS a partir de um nome qualquer
 * (customName escolhido pelo usuário ou bankName vindo do Pluggy).
 * Retorna null se o banco não estiver mapeado.
 */
export function detectBankKey(name: string | null | undefined): string | null {
  if (!name) return null;
  if (BANK_LOGOS[name]) return name;
  for (const { match, key } of NAME_ALIASES) {
    if (match.test(name)) return key;
  }
  return null;
}

/**
 * Logo "cheio" (com fundo colorido do banco) — pra bolinha grande nas telas
 * de Contas e Início. Auto-detecta pelo customName OU bankName; só cai pro
 * logo do connector Pluggy se nenhum dos dois bater no mapping.
 */
export function effectiveLogoUrl(acc: Pick<Account, 'customName' | 'bankName' | 'logoUrl'>): string | null | undefined {
  const key = detectBankKey(acc.customName) ?? detectBankKey(acc.bankName);
  if (key) return BANK_LOGOS[key].filled;
  return acc.logoUrl;
}

/** Logo pequeno transparente — pra linhas de transação ao lado da conta. */
export function inlineLogoUrl(name: string | null | undefined): string | null {
  const key = detectBankKey(name);
  if (!key) return null;
  return BANK_LOGOS[key].inline;
}

/**
 * Quando o logo já tem fundo próprio (ex: Nubank roxo), não queremos pintar
 * a bolinha externa com a cor do connector também. Suprime primaryColor
 * sempre que reconhecemos o banco (custom ou Pluggy).
 */
export function effectivePrimaryColor(acc: Pick<Account, 'customName' | 'bankName' | 'primaryColor'>): string | null | undefined {
  if (detectBankKey(acc.customName) ?? detectBankKey(acc.bankName)) return null;
  return acc.primaryColor;
}

export function formatBankAccountLabel(ba: BankAccount, connector?: Pick<Account, 'bankName'>): string {
  const base = ba.marketingName || ba.name || connector?.bankName || 'Conta';
  const suffix = ba.number ? ` ·${String(ba.number).slice(-4)}` : '';
  return `${base}${suffix}`;
}

export type FlatBankAccount = BankAccount & {
  label: string;
  connectorName: string;
  connectorId: string;
  connectorLogoUrl?: string | null;
  connectorColor?: string | null;
};

export function flattenAccountsToBankAccounts(accounts: Account[]): FlatBankAccount[] {
  const flat: FlatBankAccount[] = [];
  for (const acc of accounts) {
    const bas = acc.bankAccounts ?? [];
    for (const ba of bas) {
      flat.push({
        ...ba,
        label: formatBankAccountLabel(ba, acc),
        connectorName: acc.bankName,
        connectorId: acc.id,
        connectorLogoUrl: acc.logoUrl,
        connectorColor: acc.primaryColor,
      });
    }
  }
  return flat;
}
