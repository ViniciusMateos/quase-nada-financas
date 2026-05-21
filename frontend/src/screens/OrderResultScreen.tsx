import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { Button } from '@/ui/Button';

// Shape vindo do backend (InvestmentOrder do Prisma).
type BackendOrder = {
  id: string;
  asset: string;
  amountBrl: number;
  amountAsset: number | null;
  status: 'FILLED' | 'PENDING' | 'FAILED' | string;
  errorMessage: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  FILLED: 'Executada',
  PENDING: 'Pendente',
  FAILED: 'Falhou',
};

export default function OrderResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const order = route.params.order as BackendOrder;
  const success = order.status === 'FILLED' || order.status === 'PENDING';
  return (
    <View style={[styles.container, { backgroundColor: colors.brandBackground }]}>
      <Text style={[styles.title, { color: success ? colors.brandTextPositive : colors.brandTextError }]}>
        {success ? 'Ordem enviada' : 'Ordem falhou'}
      </Text>
      <Text style={[styles.amount, { color: colors.brandTextPrimary }]}>{formatCurrency(order.amountBrl)}</Text>
      <Text style={[styles.detail, { color: colors.brandTextSecondary }]}>
        Compra de {order.asset}
        {order.amountAsset ? ` • ${order.amountAsset} ${order.asset}` : ''}
      </Text>
      <Text style={[styles.detail, { color: colors.brandTextSecondary }]}>
        Status: {STATUS_LABEL[order.status] ?? order.status}
      </Text>
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
