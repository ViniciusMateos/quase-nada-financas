import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useTheme } from '@/contexts/ThemeContext';
import { detectBankKey, effectiveLogoUrl, effectivePrimaryColor } from '@/lib/bankAccountLabel';
import { BankBadge } from '@/ui/BankBadge';
import { BankIconInline } from '@/ui/BankIconInline';
import { CategoryIcon } from '@/ui/CategoryIcon';
import type { Account, BinanceAsset, Transaction } from '@/types/api.types';

/** Extrai o nome do banco/conector do label "Nubank · Conta corrente". */
function extractBankName(accountName?: string | null): string | null {
  if (!accountName) return null;
  return accountName.split('·')[0]?.trim() || null;
}

export function TransactionCard({ item, onPress, isFirst, isLast }: { item: Transaction; onPress?: () => void; isFirst?: boolean; isLast?: boolean }) {
  const { colors, radius } = useTheme();
  const positive = item.amount > 0;
  // Badge "1/5" quando é compra parcelada (totalInstallments > 1).
  const installmentLabel =
    item.installmentTotal && item.installmentTotal > 1
      ? `${item.installmentCurrent ?? 1}/${item.installmentTotal}`
      : null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.brandSurface,
          borderTopLeftRadius: isFirst ? radius.lg : 0,
          borderTopRightRadius: isFirst ? radius.lg : 0,
          borderBottomLeftRadius: isLast ? radius.lg : 0,
          borderBottomRightRadius: isLast ? radius.lg : 0,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.brandDivider,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={{ marginRight: 12 }}>
        <CategoryIcon icon={item.categoryIcon} color={item.categoryColor || colors.brandPrimary} size={20} />
      </View>
      <View style={styles.middle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.brandTextPrimary, flexShrink: 1 }]}>{item.description}</Text>
          {installmentLabel ? (
            <View style={[styles.installmentBadge, { backgroundColor: colors.brandPrimaryTint }]}>
              <Text style={[styles.installmentText, { color: colors.brandPrimaryDark }]}>{installmentLabel}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <BankIconInline bankName={extractBankName(item.accountName)} size={12} />
          <Text numberOfLines={1} style={[styles.meta, { color: colors.brandTextSecondary, flex: 1 }]}>
            {item.accountName || 'Conta'} • {item.categoryName || 'Sem categoria'}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: positive ? colors.brandTextPositive : colors.brandTextNegative }]}>
          {positive ? '+' : '-'}{formatCurrency(Math.abs(item.amount))}
        </Text>
        <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>{formatDate(item.occurredAt)}</Text>
      </View>
    </Pressable>
  );
}

/** "MASTERCARD" → "Mastercard". Retorna null quando não há bandeira. */
function formatBrand(brand?: string | null): string | null {
  if (!brand) return null;
  const b = brand.trim();
  if (!b) return null;
  return b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
}

function bankAccountShortLabel(ba: { type?: string; subtype?: string | null; marketingName?: string | null; name?: string | null }): string {
  if (ba.type === 'CREDIT') return 'Cartão';
  switch (ba.subtype) {
    case 'CHECKING_ACCOUNT': return 'Conta corrente';
    case 'SAVINGS_ACCOUNT': return 'Poupança';
    case 'PREPAID_ACCOUNT': return 'Conta pré-paga';
    case 'PAYMENT_ACCOUNT': return 'Conta de pagamento';
    default: return 'Conta';
  }
}

export function AccountCard({ account, onPress, onDelete, onSync, onSubPress, onRename, investedBrl, onInvestedPress }: { account: Account; onPress: () => void; onDelete: () => void; onSync: () => void; onSubPress?: (bankAccountId: string) => void; onRename?: () => void; investedBrl?: number | null; onInvestedPress?: () => void }) {
  const { colors, radius, shadows } = useTheme();
  const subAccounts = account.bankAccounts ?? [];
  const bankSum = subAccounts.filter((a) => a.type !== 'CREDIT').reduce((acc, a) => acc + a.balance, 0);
  // Cartão: usa fatura aberta (calculada no backend), não saldo devedor total.
  const creditSum = subAccounts
    .filter((a) => a.type === 'CREDIT')
    .reduce((acc, a) => acc + (a.currentStatementAmount ?? a.balance), 0);
  const displayBalance = subAccounts.length > 0 ? bankSum : account.balance ?? 0;
  const lastSync = subAccounts.map((a) => a.lastSyncAt).filter(Boolean).sort().pop() ?? account.lastSyncedAt;
  const displayName = account.customName || account.bankName;

  // Consolida sub-contas com o mesmo rótulo (ex: corretora com 2 "Conta corrente"
  // vira uma só, somando os saldos).
  const mergedSubRows = (() => {
    type Row = { key: string; label: string; isCredit: boolean; value: number; dueDate?: string | null };
    const map = new Map<string, Row>();
    for (const ba of subAccounts) {
      const isCredit = ba.type === 'CREDIT';
      // Cartão: sem número, só a bandeira (Mastercard/Visa...) quando houver.
      const brand = isCredit ? formatBrand(ba.creditBrand) : null;
      const label = bankAccountShortLabel(ba) + (brand ? ` · ${brand}` : '');
      // Valor exibido no cartão = fatura (balance oficial do Pluggy).
      const value = isCredit ? ba.currentStatementAmount ?? ba.balance : ba.balance;
      const existing = map.get(label);
      if (existing) {
        existing.value += value;
      } else {
        map.set(label, {
          key: label,
          label,
          isCredit,
          value,
          dueDate: isCredit ? ba.statementDueDate ?? null : undefined,
        });
      }
    }
    return [...map.values()];
  })();

  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card, marginBottom: subAccounts.length > 0 ? 6 : 0 },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={styles.cardIconWrap}>
          <BankBadge bankName={displayName} logoUrl={effectiveLogoUrl(account)} primaryColor={effectivePrimaryColor(account)} size={48} variant={detectBankKey(account.customName) ?? detectBankKey(account.bankName) ? 'filled' : 'padded'} />
        </View>
        <View style={styles.middle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.title, { color: colors.brandTextPrimary }]} numberOfLines={1}>{displayName}</Text>
            {onRename ? (
              <Ionicons name="pencil-outline" size={14} color={colors.brandTextSecondary} onPress={onRename} />
            ) : null}
          </View>
          <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>
            {subAccounts.length > 0 ? `${subAccounts.length} ${subAccounts.length === 1 ? 'conta' : 'contas'}` : (account.type || 'Conta')} • atualizado {lastSync ? formatDate(lastSync) : 'pendente'}
          </Text>
          {creditSum > 0 ? (
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Fatura do cartão',
                  'É o valor da fatura vindo direto do banco (Open Finance), com o vencimento configurado.\n\nSe algum cartão estiver com valor divergente do app do banco, é porque o Open Finance está com o dado atrasado — reconectar o cartão em Contas atualiza.',
                  [{ text: 'Entendi' }]
                )
              }
              hitSlop={6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
            >
              <Text style={[styles.meta, { color: colors.brandTextNegative }]}>
                fatura: {formatCurrency(creditSum)}
              </Text>
              <Ionicons name="information-circle-outline" size={12} color={colors.brandTextNegative} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.right}>
          <Text style={[styles.balance, { color: colors.brandTextPrimary }]}>{formatCurrency(displayBalance)}</Text>
          <View style={styles.actions}>
            <Ionicons name="refresh-outline" size={22} color={colors.brandInfo} onPress={onSync} />
            <Ionicons name="trash-outline" size={22} color={colors.brandError} onPress={onDelete} />
          </View>
        </View>
      </Pressable>

      {mergedSubRows.map((row) => (
        <Pressable
          key={row.key}
          onPress={() => onSubPress?.(row.key)}
          style={({ pressed }) => [
            styles.subRow,
            { backgroundColor: colors.brandSurface, borderRadius: radius.md, ...shadows.card },
            pressed && { opacity: 0.8 },
          ]}
        >
          <View style={[styles.subDot, { backgroundColor: row.isCredit ? colors.brandTextNegative : colors.brandPrimaryDark }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.subLabel, { color: colors.brandTextPrimary }]} numberOfLines={1}>{row.label}</Text>
            {row.isCredit && row.dueDate ? (
              <Text style={[styles.subMeta, { color: colors.brandTextSecondary }]} numberOfLines={1}>
                vence {formatDate(row.dueDate)}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.subBalance, { color: row.isCredit ? colors.brandTextNegative : colors.brandTextPrimary }]}>
              {formatCurrency(row.value)}
            </Text>
            {row.isCredit ? (
              <Text style={[styles.subMeta, { color: colors.brandTextSecondary }]}>fatura</Text>
            ) : null}
          </View>
        </Pressable>
      ))}

      {investedBrl != null && investedBrl > 0 ? (
        <Pressable
          onPress={onInvestedPress}
          style={({ pressed }) => [
            styles.subRow,
            { backgroundColor: colors.brandSurface, borderRadius: radius.md, ...shadows.card },
            pressed && { opacity: 0.8 },
          ]}
        >
          <View style={[styles.subDot, { backgroundColor: colors.brandInfo }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.subLabel, { color: colors.brandTextPrimary }]} numberOfLines={1}>Investido</Text>
          </View>
          <Text style={[styles.subBalance, { color: colors.brandTextPrimary }]}>{formatCurrency(investedBrl)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Logos oficiais via repo público de ícones de cripto
const CRYPTO_ICON_BASE = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/svg/color';

const CRYPTO_META: Record<string, { name: string; bg: string; fg: string }> = {
  BTC: { name: 'Bitcoin', bg: '#F7931A', fg: '#FFFFFF' },
  ETH: { name: 'Ethereum', bg: '#627EEA', fg: '#FFFFFF' },
  USDT: { name: 'Tether', bg: '#26A17B', fg: '#FFFFFF' },
  USDC: { name: 'USD Coin', bg: '#2775CA', fg: '#FFFFFF' },
  BNB: { name: 'BNB', bg: '#F3BA2F', fg: '#000000' },
  SOL: { name: 'Solana', bg: '#000000', fg: '#FFFFFF' },
  ADA: { name: 'Cardano', bg: '#0033AD', fg: '#FFFFFF' },
  XRP: { name: 'XRP', bg: '#23292F', fg: '#FFFFFF' },
  DOGE: { name: 'Dogecoin', bg: '#C2A633', fg: '#FFFFFF' },
  DOT: { name: 'Polkadot', bg: '#E6007A', fg: '#FFFFFF' },
  MATIC: { name: 'Polygon', bg: '#8247E5', fg: '#FFFFFF' },
  BRL: { name: 'Real Brasileiro', bg: '#22C55E', fg: '#FFFFFF' },
};

function cryptoIconUrl(symbol: string, size: number): string {
  if (symbol === 'BRL') return '';
  const url = `${CRYPTO_ICON_BASE}/${symbol.toLowerCase()}.svg`;
  const noProtocol = url.replace(/^https?:\/\//i, '');
  const px = Math.max(64, Math.round(size * 3));
  return `https://images.weserv.nl/?url=${encodeURIComponent(noProtocol)}&output=png&w=${px}&h=${px}&fit=contain`;
}

function formatCryptoQuantity(qty: number, symbol: string): string {
  if (symbol === 'BRL') return qty.toFixed(2);
  if (qty >= 1) return qty.toFixed(4);
  if (qty >= 0.01) return qty.toFixed(6);
  return qty.toFixed(8);
}

export function AssetRow({ asset, formatValue }: { asset: BinanceAsset; formatValue?: (brl: number) => string }) {
  const { colors } = useTheme();
  const positive = asset.change24h >= 0;
  const meta = CRYPTO_META[asset.symbol] ?? { name: asset.name || asset.symbol, bg: colors.brandPrimaryTint, fg: colors.brandPrimaryDark };
  const iconUrl = cryptoIconUrl(asset.symbol, 44);
  const formattedValue = formatValue ? formatValue(asset.valueBRL) : formatCurrency(asset.valueBRL);
  return (
    <View style={[styles.row, { backgroundColor: colors.brandSurface }]}>
      <View style={[styles.icon, { backgroundColor: meta.bg, overflow: 'hidden' }]}>
        {iconUrl ? (
          <Image source={{ uri: iconUrl }} style={{ width: 44, height: 44 }} resizeMode="cover" />
        ) : asset.symbol === 'BRL' ? (
          <Text style={{ color: meta.fg, fontSize: 18, fontWeight: '900' }}>R$</Text>
        ) : (
          <Text style={[styles.assetSymbol, { color: meta.fg }]}>{asset.symbol.slice(0, 3)}</Text>
        )}
      </View>
      <View style={styles.middle}>
        <Text style={[styles.title, { color: colors.brandTextPrimary }]}>{asset.symbol}</Text>
        <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>{meta.name}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.brandTextPrimary }]}>{formatCryptoQuantity(asset.quantity, asset.symbol)}</Text>
        <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>{formattedValue}</Text>
        {asset.change24h !== 0 ? (
          <Text style={{ color: positive ? colors.brandTextPositive : colors.brandTextNegative, fontWeight: '700' }}>
            {positive ? '+' : ''}{asset.change24h.toFixed(2)}%
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 68, padding: 16, flexDirection: 'row', alignItems: 'center' },
  card: { padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardIconWrap: { marginRight: 12 },
  iconText: { fontSize: 20 },
  middle: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  installmentBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  installmentText: { fontSize: 11, fontWeight: '800' },
  meta: { fontSize: 12 },
  amount: { fontSize: 15, fontWeight: '800' },
  balance: { fontSize: 17, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 12 },
  assetSymbol: { fontWeight: '800', fontSize: 11 },
  subRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, marginLeft: 24, marginTop: 6, gap: 12 },
  subDot: { width: 8, height: 8, borderRadius: 4 },
  subLabel: { fontSize: 13, fontWeight: '700' },
  subMeta: { fontSize: 11, marginTop: 1 },
  subBalance: { fontSize: 14, fontWeight: '800' },
});
