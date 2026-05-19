import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useTheme } from '@/contexts/ThemeContext';
import { effectiveLogoUrl, effectivePrimaryColor } from '@/lib/bankAccountLabel';
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
        <Text numberOfLines={1} style={[styles.title, { color: colors.brandTextPrimary }]}>{item.description}</Text>
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

export function AccountCard({ account, onPress, onDelete, onSync, onSubPress, onRename }: { account: Account; onPress: () => void; onDelete: () => void; onSync: () => void; onSubPress?: (bankAccountId: string) => void; onRename?: () => void }) {
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
          <BankBadge bankName={displayName} logoUrl={effectiveLogoUrl(account)} primaryColor={effectivePrimaryColor(account)} size={48} variant={account.customName ? 'filled' : 'padded'} />
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
            <Text style={[styles.meta, { color: colors.brandTextNegative, marginTop: 2 }]}>
              fatura: {formatCurrency(creditSum)}
            </Text>
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

      {subAccounts.map((ba) => {
        const isCredit = ba.type === 'CREDIT';
        const label = bankAccountShortLabel(ba);
        const suffix = isCredit && ba.number ? ` ·${String(ba.number).slice(-4)}` : '';
        return (
          <Pressable
            key={ba.id}
            onPress={() => onSubPress?.(ba.id)}
            style={({ pressed }) => [
              styles.subRow,
              { backgroundColor: colors.brandSurface, borderRadius: radius.md, ...shadows.card },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={[styles.subDot, { backgroundColor: isCredit ? colors.brandTextNegative : colors.brandPrimaryDark }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.subLabel, { color: colors.brandTextPrimary }]} numberOfLines={1}>
                {label}{suffix}
              </Text>
            </View>
            <Text style={[styles.subBalance, { color: isCredit ? colors.brandTextNegative : colors.brandTextPrimary }]}>
              {formatCurrency(ba.balance)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AssetRow({ asset }: { asset: BinanceAsset }) {
  const { colors } = useTheme();
  const positive = asset.change24h >= 0;
  return (
    <View style={[styles.row, { backgroundColor: colors.brandSurface }]}>
      <View style={[styles.icon, { backgroundColor: colors.brandPrimaryTint }]}>
        <Text style={[styles.assetSymbol, { color: colors.brandPrimaryDark }]}>{asset.symbol.slice(0, 3)}</Text>
      </View>
      <View style={styles.middle}>
        <Text style={[styles.title, { color: colors.brandTextPrimary }]}>{asset.symbol}</Text>
        <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>{asset.name}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.brandTextPrimary }]}>{asset.quantity}</Text>
        <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>{formatCurrency(asset.valueBRL)}</Text>
        <Text style={{ color: positive ? colors.brandTextPositive : colors.brandTextNegative, fontWeight: '700' }}>
          {positive ? '+' : ''}{asset.change24h.toFixed(2)}%
        </Text>
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
