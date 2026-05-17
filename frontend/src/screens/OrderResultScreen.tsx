import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { Button } from '@/ui/Button';
import type { Order } from '@/types/api.types';

export default function OrderResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const order = route.params.order as Order;
  const success = order.status === 'filled' || order.status === 'pending';
  return (
    <View style={[styles.container, { backgroundColor: colors.brandBackground }]}>
      <Text style={[styles.title, { color: success ? colors.brandTextPositive : colors.brandTextError }]}>
        {success ? 'Ordem enviada' : 'Ordem falhou'}
      </Text>
      <Text style={[styles.amount, { color: colors.brandTextPrimary }]}>{formatCurrency(order.amountBRL)}</Text>
      <Text style={[styles.detail, { color: colors.brandTextSecondary }]}>
        {order.symbol} • {order.side === 'buy' ? 'Compra' : 'Venda'}
      </Text>
      <Text style={[styles.detail, { color: colors.brandTextSecondary }]}>Status: {order.status}</Text>
      <Text style={[styles.detail, { color: colors.brandTextSecondary }]}>
        Criada em {formatDateTime(order.createdAt)}
      </Text>
      {order.errorMessage ? (
        <Text style={[styles.error, { color: colors.brandTextError }]}>{order.errorMessage}</Text>
      ) : null}
      <Button
        label="Voltar para Investimentos"
        onPress={() => navigation.navigate('AppTabs', { screen: 'Investimentos' })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
  amount: { fontSize: 34, fontWeight: '900', textAlign: 'center' },
  detail: { textAlign: 'center' },
  error: { textAlign: 'center', fontWeight: '700' },
});
