import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useInvestments } from '@/hooks/useInvestments';
import { formatCurrency } from '@/lib/formatters';
import { theme } from '@/theme/theme';
import { AssetRow } from '@/ui/Cards';
import { Button } from '@/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/ui/States';

export default function InvestmentsScreen() {
  const navigation = useNavigation<any>();
  const { wallet, quote, loading, error, reload } = useInvestments('BTC');
  if (loading) return <View style={styles.container}><Skeleton height={120} /><Skeleton /><Skeleton /></View>;
  if (error) return <ErrorState subtitle={error} onRetry={reload} />;
  if (!wallet?.connected) return <EmptyState title="Binance nao conectada" actionLabel="Conectar Binance" onAction={() => navigation.navigate('ConnectBinance')} />;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.meta}>Carteira Binance</Text>
        <Text style={styles.total}>{formatCurrency(wallet.totalBRL)}</Text>
        {quote ? <Text style={styles.meta}>BTC agora: {formatCurrency(quote.priceBRL)}</Text> : null}
      </View>
      <Button label="Nova Ordem" icon="add" onPress={() => navigation.navigate('NewOrder')} />
      <Text style={styles.section}>Ativos</Text>
      {wallet.assets.map((asset) => <AssetRow key={asset.symbol} asset={asset} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.brandBackground, gap: 16 },
  card: { padding: 20, borderRadius: theme.radius.xl, backgroundColor: theme.colors.brandPrimaryDark },
  meta: { color: '#FFFFFF', opacity: 0.82 },
  total: { marginVertical: 8, color: '#FFFFFF', fontSize: 32, fontWeight: '900' },
  section: { fontSize: 17, fontWeight: '800', color: theme.colors.brandTextPrimary }
});
