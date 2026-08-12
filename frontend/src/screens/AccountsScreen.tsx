import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAccounts } from '@/hooks/useAccounts';
import { useInvestments } from '@/hooks/useInvestments';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { useForegroundRefresh } from '@/hooks/useForegroundRefresh';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/lib/formatters';
import { accountsService } from '@/services/accounts.service';
import { Button } from '@/ui/Button';
import { AccountCard } from '@/ui/Cards';
import { EmptyState, ErrorState, ListSkeleton } from '@/ui/States';
import { TabScreen, TabScreenScroll } from '@/ui/TabScreen';

// Logo da Binance (losango dourado do BNB) via proxy de imagem já usado no app.
const BINANCE_LOGO =
  'https://images.weserv.nl/?url=raw.githubusercontent.com%2Fspothq%2Fcryptocurrency-icons%2Fmaster%2Fsvg%2Fcolor%2Fbnb.svg&output=png&w=120&h=120&fit=contain';

export default function AccountsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { items, loading, error, load, remove, sync, rename } = useAccounts();
  const { wallet } = useInvestments();
  const { data: portfolio } = usePortfolio();
  const [refreshing, setRefreshing] = useState(false);

  // Total investido por instituição (Rico, XP...) pra mostrar a linha "Investido" no card.
  const investedBySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of portfolio?.groups ?? []) m.set(g.source, g.totals.current);
    return m;
  }, [portfolio]);

  useFocusRefresh(load);

  const accounts = Array.isArray(items) ? items : [];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled(accounts.map((acc) => accountsService.sync(acc.id)));
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [accounts, load]);

  const handleRename = useCallback((accountId: string, currentLabel: string) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Renomear conta',
        'Escolha um nome para essa conexão (ex: Nubank, Mercado Pago).',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Salvar',
            onPress: (text?: string) => {
              const next = (text ?? '').trim();
              rename(accountId, next || null).catch((err) => Alert.alert('Erro', String(err)));
            },
          },
        ],
        'plain-text',
        currentLabel
      );
    } else {
      // Android: Alert.prompt não existe nativamente — fallback simples
      Alert.alert('Renomear conta', 'No Android use o iOS por enquanto, vamos adicionar modal depois.');
    }
  }, [rename]);

  useForegroundRefresh(handleRefresh);

  if (error) {
    return (
      <TabScreen>
        <ErrorState subtitle={error} onRetry={load} />
      </TabScreen>
    );
  }

  return (
    <TabScreenScroll refreshing={refreshing} loading={loading && accounts.length === 0} onRefresh={handleRefresh}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Minhas contas</Text>
        <Button
          label="Conectar"
          icon="add"
          onPress={() => navigation.navigate('ConnectBank')}
          style={{ width: 136, minHeight: 44 }}
        />
      </View>

      {loading && accounts.length === 0 ? (
        <ListSkeleton />
      ) : accounts.length === 0 ? (
        <EmptyState
          title="Nenhuma conta conectada"
          actionLabel="Conectar minha primeira conta"
          onAction={() => navigation.navigate('ConnectBank')}
        />
      ) : (
        accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onPress={() => navigation.navigate('Transacoes', { accountId: account.id, _ts: Date.now() })}
            onDelete={() => remove(account.id)}
            onSync={() => sync(account.id)}
            onSubPress={() => navigation.navigate('Transacoes', { accountId: account.id, _ts: Date.now() })}
            onRename={() => handleRename(account.id, account.customName || account.bankName)}
            investedBrl={investedBySource.get(account.customName || account.bankName) ?? null}
            onInvestedPress={() => navigation.navigate('Ativos')}
          />
        ))
      )}

      {wallet?.connected ? (
        <Pressable
          onPress={() => navigation.navigate('Investimentos')}
          style={({ pressed }) => [
            styles.binanceCard,
            { backgroundColor: colors.brandSurface, borderColor: colors.brandDivider },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={styles.binanceLogo}>
            <Image source={{ uri: BINANCE_LOGO }} style={{ width: 30, height: 30 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.binanceName, { color: colors.brandTextPrimary }]}>Binance</Text>
            <Text style={[styles.binanceMeta, { color: colors.brandTextSecondary }]}>
              Carteira cripto{wallet.assets.length ? ` • ${wallet.assets.length} ${wallet.assets.length === 1 ? 'ativo' : 'ativos'}` : ''}
            </Text>
          </View>
          <Text style={[styles.binanceBalance, { color: colors.brandTextPrimary }]}>
            {formatCurrency(wallet.totalBRL)}
          </Text>
        </Pressable>
      ) : null}
    </TabScreenScroll>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800' },
  binanceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  binanceLogo: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  binanceName: { fontSize: 15, fontWeight: '700' },
  binanceMeta: { fontSize: 12, marginTop: 2 },
  binanceBalance: { fontSize: 17, fontWeight: '800' },
});
