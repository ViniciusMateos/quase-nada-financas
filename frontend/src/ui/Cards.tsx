import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { theme } from '@/theme/theme';
import type { Account, BinanceAsset, Transaction } from '@/types/api.types';

export function TransactionCard({ item, onPress }: { item: Transaction; onPress?: () => void }) {
  const positive = item.amount > 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.icon}><Text>{item.categoryIcon || '$'}</Text></View>
      <View style={styles.middle}>
        <Text numberOfLines={1} style={styles.title}>{item.description}</Text>
        <Text numberOfLines={1} style={styles.meta}>{item.accountName || 'Conta'} • {item.categoryName || 'Sem categoria'}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, positive ? styles.positive : styles.negative]}>{positive ? '+' : '-'}{formatCurrency(Math.abs(item.amount))}</Text>
        <Text style={styles.meta}>{formatDate(item.date)}</Text>
      </View>
    </Pressable>
  );
}

export function AccountCard({ account, onPress, onDelete, onSync }: { account: Account; onPress: () => void; onDelete: () => void; onSync: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Ionicons name="business-outline" size={30} color={theme.colors.brandPrimaryDark} />
      <View style={styles.middle}>
        <Text style={styles.title}>{account.bankName}</Text>
        <Text style={styles.meta}>{account.type} • atualizado {account.lastSyncedAt ? formatDate(account.lastSyncedAt) : 'pendente'}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.balance}>{formatCurrency(account.balance)}</Text>
        <View style={styles.actions}>
          <Ionicons name="refresh-outline" size={22} color={theme.colors.brandInfo} onPress={onSync} />
          <Ionicons name="trash-outline" size={22} color={theme.colors.brandError} onPress={onDelete} />
        </View>
      </View>
    </Pressable>
  );
}

export function AssetRow({ asset }: { asset: BinanceAsset }) {
  const positive = asset.change24h >= 0;
  return (
    <View style={styles.row}>
      <View style={styles.icon}><Text style={styles.assetSymbol}>{asset.symbol.slice(0, 3)}</Text></View>
      <View style={styles.middle}>
        <Text style={styles.title}>{asset.symbol}</Text>
        <Text style={styles.meta}>{asset.name}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{asset.quantity}</Text>
        <Text style={styles.meta}>{formatCurrency(asset.valueBRL)}</Text>
        <Text style={positive ? styles.positive : styles.negative}>{positive ? '+' : ''}{asset.change24h.toFixed(2)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 68, padding: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.brandDivider, backgroundColor: theme.colors.brandSurface },
  card: { padding: 16, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.brandSurface, marginBottom: 8 },
  pressed: { backgroundColor: '#F0F4F8' },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brandPrimaryTint, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  middle: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  title: { fontSize: 15, fontWeight: '700', color: theme.colors.brandTextPrimary },
  meta: { fontSize: 12, color: theme.colors.brandTextSecondary },
  amount: { fontSize: 15, fontWeight: '700', color: theme.colors.brandTextPrimary },
  balance: { fontSize: 16, fontWeight: '800', color: theme.colors.brandTextPrimary },
  positive: { color: theme.colors.brandTextPositive, fontWeight: '700' },
  negative: { color: theme.colors.brandTextNegative, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12 },
  assetSymbol: { fontWeight: '800', color: theme.colors.brandPrimaryDark, fontSize: 11 }
});
