import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { theme } from '@/theme/theme';
import { Button } from '@/ui/Button';
import type { Order } from '@/types/api.types';

export default function OrderResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const order = route.params.order as Order;
  const success = order.status === 'filled' || order.status === 'pending';
  return (
    <View style={styles.container}>
      <Text style={[styles.title, success ? styles.success : styles.error]}>{success ? 'Ordem enviada' : 'Ordem falhou'}</Text>
      <Text style={styles.amount}>{formatCurrency(order.amountBRL)}</Text>
      <Text style={styles.detail}>{order.symbol} • {order.side === 'buy' ? 'Compra' : 'Venda'}</Text>
      <Text style={styles.detail}>Status: {order.status}</Text>
      <Text style={styles.detail}>Criada em {formatDateTime(order.createdAt)}</Text>
      {order.errorMessage ? <Text style={styles.error}>{order.errorMessage}</Text> : null}
      <Button label="Voltar para Investimentos" onPress={() => navigation.navigate('AppTabs', { screen: 'Investimentos' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 16, backgroundColor: theme.colors.brandBackground },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
  amount: { fontSize: 34, fontWeight: '900', textAlign: 'center', color: theme.colors.brandTextPrimary },
  detail: { textAlign: 'center', color: theme.colors.brandTextSecondary },
  success: { color: theme.colors.brandTextPositive },
  error: { color: theme.colors.brandTextError, textAlign: 'center', fontWeight: '700' }
});
