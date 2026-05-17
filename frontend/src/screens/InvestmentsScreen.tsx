import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useInvestments } from '@/hooks/useInvestments';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/lib/formatters';
import { AssetRow } from '@/ui/Cards';
import { Button } from '@/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/ui/States';
import { TabScreen } from '@/ui/TabScreen';

export default function InvestmentsScreen() {
  const navigation = useNavigation<any>();
  const { colors, radius, shadows } = useTheme();
  const { wallet, quote, loading, error, reload } = useInvestments('BTC');

  if (loading) {
    return (
      <TabScreen>
        <Skeleton height={120} /><Skeleton /><Skeleton />
      </TabScreen>
    );
  }
  if (error) {
    return (
      <TabScreen>
        <ErrorState subtitle={error} onRetry={reload} />
      </TabScreen>
    );
  }
  if (!wallet?.connected) {
    return (
      <TabScreen>
        <EmptyState
          title="Binance não conectada"
          actionLabel="Conectar Binance"
          onAction={() => navigation.navigate('ConnectBinance')}
        />
      </TabScreen>
    );
  }

  return (
    <TabScreen>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.brandPrimaryDark, borderRadius: radius.xl, ...shadows.glow },
        ]}
      >
        <Text style={styles.meta}>Carteira Binance</Text>
        <Text style={styles.total}>{formatCurrency(wallet.totalBRL)}</Text>
        {quote ? <Text style={styles.meta}>BTC agora: {formatCurrency(quote.priceBRL)}</Text> : null}
      </View>
      <Button label="Nova ordem" icon="add" onPress={() => navigation.navigate('NewOrder')} />
      <Text style={[styles.section, { color: colors.brandTextPrimary }]}>Ativos</Text>
      <View style={[styles.assets, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card, overflow: 'hidden' }]}>
        {wallet.assets.map((asset) => <AssetRow key={asset.symbol} asset={asset} />)}
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16, gap: 16 },
  card: { padding: 22 },
  meta: { color: '#FFFFFF', opacity: 0.85, fontSize: 13, fontWeight: '600' },
  total: { marginVertical: 8, color: '#FFFFFF', fontSize: 32, fontWeight: '900' },
  section: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  assets: {},
});
