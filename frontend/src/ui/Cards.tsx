import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { categoryEmoji } from '@/lib/categoryIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { BankBadge } from '@/ui/BankBadge';
import type { Account, BinanceAsset, Transaction } from '@/types/api.types';

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
      <View style={[styles.icon, { backgroundColor: colors.brandPrimaryTint }]}>
        <Text style={styles.iconText}>{categoryEmoji(item.categoryIcon)}</Text>
      </View>
      <View style={styles.middle}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.brandTextPrimary }]}>{item.description}</Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.brandTextSecondary }]}>
          {item.accountName || 'Conta'} • {item.categoryName || 'Sem categoria'}
        </Text>
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

export function AccountCard({ account, onPress, onDelete, onSync }: { account: Account; onPress: () => void; onDelete: () => void; onSync: () => void }) {
  const { colors, radius, shadows } = useTheme();
  const subAccounts = account.bankAccounts ?? [];
  const bankSum = subAccounts.filter((a) => a.type !== 'CREDIT').reduce((acc, a) => acc + a.balance, 0);
  const creditSum = subAccounts.filter((a) => a.type === 'CREDIT').reduce((acc, a) => acc + a.balance, 0);
  const displayBalance = subAccounts.length > 0 ? bankSum : account.balance ?? 0;
  const lastSync = subAccounts.map((a) => a.lastSyncAt).filter(Boolean).sort().pop() ?? account.lastSyncedAt;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.cardIconWrap}>
        <BankBadge bankName={account.bankName} logoUrl={account.logoUrl} primaryColor={account.primaryColor} size={48} />
      </View>
      <View style={styles.middle}>
        <Text style={[styles.title, { color: colors.brandTextPrimary }]}>{account.bankName}</Text>
        <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>
          {subAccounts.length > 0 ? `${subAccounts.length} contas` : (account.type || 'Conta')} • atualizado {lastSync ? formatDate(lastSync) : 'pendente'}
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
});
