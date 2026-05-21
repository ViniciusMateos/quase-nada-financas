import * as SecureStore from 'expo-secure-store';

const KEY = 'qnf_saved_accounts';

export type SavedAccount = {
  email: string;
  name: string | null;
  refreshToken: string;
  color?: string | null;
};

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Insere ou atualiza (por email) uma conta salva. Mantém a mais recente no topo. */
export async function upsertSavedAccount(account: SavedAccount): Promise<void> {
  const list = await getSavedAccounts();
  const existing = list.find((a) => a.email === account.email);
  const filtered = list.filter((a) => a.email !== account.email);
  // Preserva a cor escolhida pelo usuário entre logins (o login não a envia).
  const merged: SavedAccount = { color: existing?.color ?? null, ...account };
  if (account.color == null && existing?.color) merged.color = existing.color;
  const next = [merged, ...filtered].slice(0, 8); // limite defensivo
  await SecureStore.setItemAsync(KEY, JSON.stringify(next));
}

/** Atualiza campos pontuais (ex.: cor do avatar) de uma conta salva pelo email. */
export async function updateSavedAccount(
  email: string,
  patch: Partial<Omit<SavedAccount, 'email'>>
): Promise<void> {
  const list = await getSavedAccounts();
  let changed = false;
  const next = list.map((a) => {
    if (a.email !== email) return a;
    changed = true;
    return { ...a, ...patch };
  });
  if (changed) await SecureStore.setItemAsync(KEY, JSON.stringify(next));
}

export async function removeSavedAccount(email: string): Promise<void> {
  const list = await getSavedAccounts();
  const next = list.filter((a) => a.email !== email);
  await SecureStore.setItemAsync(KEY, JSON.stringify(next));
}

/**
 * Atualiza só o refreshToken de uma conta salva (sem reordenar). Chamado a cada
 * rotação de token pra a conta salva nunca ficar com um token velho/usado —
 * senão o login rápido pelo hub dispara a detecção de reuso e toma 403.
 */
export async function syncSavedAccountToken(email: string, refreshToken: string): Promise<void> {
  const list = await getSavedAccounts();
  let changed = false;
  const next = list.map((a) => {
    if (a.email !== email) return a;
    changed = true;
    return { ...a, refreshToken };
  });
  if (changed) await SecureStore.setItemAsync(KEY, JSON.stringify(next));
}
