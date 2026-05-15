import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { theme } from '@/theme/theme';
import { Button } from '@/ui/Button';
import type { Transaction } from '@/types/api.types';

export default function TransactionDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tx = route.params.transaction as Transaction;
  const positive = tx.amount > 0;
  return (
    <View style={styles.container}>
      <Button label="Voltar" variant="secondary" onPress={() => navigation.goBack()} style={{ width: 110 }} />
      <View style={styles.card}>
        <Text style={[styles.value, positive ? styles.positive : styles.negative]}>{formatCurrency(tx.amount)}</Text>
        <Text style={styles.title}>{tx.description}</Text>
        <Text style={styles.meta}>{formatDateTime(tx.date)}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.detail}>Conta: {tx.accountName || 'Conta'}</Text>
        <Text style={styles.detail}>Categoria: {tx.categoryName || 'Sem categoria'}</Text>
        <Text style={styles.detail}>Status: {tx.pending ? 'Pendente' : 'Confirmada'}</Text>
      </View>
      <Button label="Editar Categoria" onPress={() => navigation.navigate('EditCategory', { transaction: tx })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16, backgroundColor: theme.colors.brandBackground },
  card: { padding: 20, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandSurface },
  value: { fontSize: 32, fontWeight: '900' },
  positive: { color: theme.colors.brandTextPositive },
  negative: { color: theme.colors.brandTextNegative },
  title: { marginTop: 8, fontSize: 18, fontWeight: '800', color: theme.colors.brandTextPrimary },
  meta: { marginTop: 6, color: theme.colors.brandTextSecondary },
  detail: { fontSize: 15, color: theme.colors.brandTextPrimary, marginBottom: 8 }
});
