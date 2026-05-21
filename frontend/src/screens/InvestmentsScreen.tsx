import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useInvestments } from '@/hooks/useInvestments';
import { useInvestmentRules } from '@/hooks/useInvestmentRules';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { useTheme } from '@/contexts/ThemeContext';
import { openBinanceDeposit } from '@/lib/binanceDeposit';
import { formatCurrency } from '@/lib/formatters';
import { AssetRow } from '@/ui/Cards';
import { Button } from '@/ui/Button';
import { ErrorState, LoadingState } from '@/ui/States';
import { TabScreen, TabScreenScroll } from '@/ui/TabScreen';

type Currency = 'BRL' | 'USD';

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export default function InvestmentsScreen() {
  const navigation = useNavigation<any>();
  const { colors, radius, shadows } = useTheme();
  const { wallet, quote, loading, error, reload, disconnect } = useInvestments('BTC');
  const { quote: usdtQuote } = useInvestments('USDT');
  const { rules, pending, reload: reloadRules } = useInvestmentRules();
  const [currency, setCurrency] = useState<Currency>('BRL');

  const handleDisconnect = () => {
    Alert.alert(
      'Desconectar Binance?',
      'Suas chaves serão removidas. As regras de automação que usam a Binance vão parar de funcionar até você reconectar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: () => disconnect().catch(() => undefined),
        },
      ]
    );
  };

  const usdRate = usdtQuote?.priceBRL ?? 5.5;
  const fmtMoney = (brl: number) => (currency === 'BRL' ? formatCurrency(brl) : formatUsd(brl / usdRate));

  useFocusRefresh(async () => {
    await Promise.all([reload(), reloadRules()]);
  });

  const pendingCount = pending.filter((p) => p.status === 'PENDING').length;
  const activeRulesCount = rules.filter((r) => r.active).length;

  if (loading) {
    return (
      <TabScreen>
        <LoadingState />
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

  const binanceConnected = !!wallet?.connected;

  return (
    <TabScreenScroll refreshing={false} onRefresh={async () => { await Promise.all([reload(), reloadRules()]); }}>
      <Text style={[styles.screenTitle, { color: colors.brandTextPrimary }]}>Investir</Text>

      {/* Tarefas pendentes (destaque se tiver) */}
      {pendingCount > 0 ? (
        <Pressable
          onPress={() => navigation.navigate('PendingActions')}
          style={({ pressed }) => [
            styles.alertCard,
            { backgroundColor: colors.brandPrimaryDark, borderRadius: radius.lg, ...shadows.glow },
            pressed && { opacity: 0.9 },
          ]}
        >
          <Ionicons name="alarm" size={24} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>
              {pendingCount} {pendingCount === 1 ? 'tarefa pendente' : 'tarefas pendentes'}
            </Text>
            <Text style={styles.alertSub}>Toque pra aprovar ou descartar</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>
      ) : null}

      {/* Wallet Binance */}
      {binanceConnected ? (
        <View
          style={[
            styles.balanceCard,
            { backgroundColor: colors.brandPrimaryDark, borderRadius: radius.xl, ...shadows.glow },
          ]}
        >
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Carteira Binance</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.currencyToggle}>
                <Pressable onPress={() => setCurrency('BRL')} style={[styles.currencyChip, currency === 'BRL' && styles.currencyChipActive]}>
                  <Text style={[styles.currencyText, currency === 'BRL' && styles.currencyTextActive]}>BRL</Text>
                </Pressable>
                <Pressable onPress={() => setCurrency('USD')} style={[styles.currencyChip, currency === 'USD' && styles.currencyChipActive]}>
                  <Text style={[styles.currencyText, currency === 'USD' && styles.currencyTextActive]}>USD</Text>
                </Pressable>
              </View>
              <Pressable onPress={handleDisconnect} hitSlop={8}>
                <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.85)" />
              </Pressable>
            </View>
          </View>
          <Text style={styles.balanceTotal}>{fmtMoney(wallet!.totalBRL)}</Text>
          {quote ? <Text style={styles.balanceLabel}>BTC agora: {fmtMoney(quote.priceBRL)}</Text> : null}
        </View>
      ) : (
        <View style={[styles.connectCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
          <Text style={[styles.connectTitle, { color: colors.brandTextPrimary }]}>Binance não conectada</Text>
          <Text style={[styles.connectSub, { color: colors.brandTextSecondary }]}>
            Conecte sua conta pra ver saldos, fazer ordens manuais e ativar automação por regras.
          </Text>
          <Button
            label="Conectar Binance"
            icon="link-outline"
            onPress={() => navigation.navigate('ConnectBinance')}
            style={{ marginTop: 12 }}
          />
        </View>
      )}

      {/* Ações */}
      <View style={styles.actionsRow}>
        {binanceConnected ? (
          <Button
            label="Nova ordem"
            icon="add"
            onPress={() => navigation.navigate('NewOrder')}
            style={{ flex: 1 }}
          />
        ) : null}
        <Button
          label="Regras"
          icon="git-branch-outline"
          variant="secondary"
          onPress={() => navigation.navigate('InvestmentRules')}
          style={{ flex: 1 }}
        />
      </View>

      {binanceConnected ? (
        <Button
          label="Carregar saldo na Binance (Pix)"
          icon="cash-outline"
          variant="secondary"
          onPress={openBinanceDeposit}
          style={{ marginBottom: 14 }}
        />
      ) : null}

      {/* Resumo de regras */}
      <Pressable
        onPress={() => navigation.navigate('InvestmentRules')}
        style={({ pressed }) => [
          styles.summaryRow,
          { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="repeat" size={20} color={colors.brandPrimaryDark} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.summaryTitle, { color: colors.brandTextPrimary }]}>
            {activeRulesCount} {activeRulesCount === 1 ? 'regra ativa' : 'regras ativas'}
          </Text>
          <Text style={[styles.summarySub, { color: colors.brandTextSecondary }]}>
            {rules.length === 0 ? 'Crie uma regra pra automatizar aportes' : 'Toque pra gerenciar'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.brandTextSecondary} />
      </Pressable>

      {/* Ativos da Binance */}
      {binanceConnected && wallet!.assets.length > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.brandTextPrimary }]}>Ativos</Text>
          <View style={[styles.assets, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card, overflow: 'hidden' }]}>
            {wallet!.assets.map((asset) => <AssetRow key={asset.symbol} asset={asset} formatValue={fmtMoney} />)}
          </View>
        </>
      ) : null}
    </TabScreenScroll>
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 24, fontWeight: '800', marginBottom: 14 },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 14 },
  alertTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  alertSub: { color: '#FFFFFF', opacity: 0.85, fontSize: 12, marginTop: 2 },
  balanceCard: { padding: 22, marginBottom: 14 },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  balanceLabel: { color: '#FFFFFF', opacity: 0.85, fontSize: 13, fontWeight: '600' },
  balanceTotal: { marginVertical: 6, color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  currencyToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: 2 },
  currencyChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  currencyChipActive: { backgroundColor: '#FFFFFF' },
  currencyText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', opacity: 0.85 },
  currencyTextActive: { color: '#0F0F12', opacity: 1 },
  connectCard: { padding: 18, marginBottom: 14 },
  connectTitle: { fontSize: 16, fontWeight: '800' },
  connectSub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 14 },
  summaryTitle: { fontSize: 14, fontWeight: '800' },
  summarySub: { fontSize: 11, marginTop: 2 },
  section: { fontSize: 18, fontWeight: '800', marginTop: 6, marginBottom: 10 },
  assets: {},
});
