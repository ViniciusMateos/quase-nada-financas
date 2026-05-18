import type { PluggyAccount } from "../../integrations/pluggy.client.js";

const INSTITUTION_PATTERNS: Array<[RegExp, string]> = [
  [/nu\s*pagamentos|nubank/i, "Nubank"],
  [/mercado\s*pago/i, "Mercado Pago"],
  [/picpay/i, "PicPay"],
  [/pagseguro|pagbank/i, "PagBank"],
  [/banco\s*inter|^inter\b/i, "Inter"],
  [/itau|itaú/i, "Itaú"],
  [/bradesco/i, "Bradesco"],
  [/santander/i, "Santander"],
  [/banco\s*do\s*brasil|^bb\b/i, "Banco do Brasil"],
  [/caixa/i, "Caixa"],
  [/c6\s*bank|^c6\b/i, "C6"],
  [/will\s*bank/i, "Will Bank"],
  [/next/i, "Next"],
  [/safra/i, "Safra"],
  [/btg/i, "BTG Pactual"],
  [/xp\s*invest|xp\s*\b/i, "XP"],
];

export function detectInstitutionName(accounts: PluggyAccount[]): string | null {
  if (accounts.length === 0) return null;
  const names = accounts
    .flatMap((a) => [a.marketingName, a.name])
    .filter((s): s is string => Boolean(s));
  if (names.length === 0) return null;

  for (const name of names) {
    for (const [regex, label] of INSTITUTION_PATTERNS) {
      if (regex.test(name)) return label;
    }
  }

  const first = names[0];
  return first.length > 25 ? `${first.slice(0, 25)}…` : first;
}
