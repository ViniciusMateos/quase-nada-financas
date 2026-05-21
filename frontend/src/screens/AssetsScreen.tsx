import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useInvestments } from '@/hooks/useInvestments';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { EmptyState, ErrorState, ListSkeleton } from '@/ui/States';
import { LoadingDog } from '@/ui/LoadingDog';
import { BottomSheet } from '@/ui/BottomSheet';
import { TabScreenScroll } from '@/ui/TabScreen';
import { portfolioService } from '@/services/portfolio.service';
import type { PortfolioGroup, PortfolioItem, PortfolioMovement } from '@/services/portfolio.service';

const MOVEMENT_LABEL: Record<string, string> = {
  BUY: 'Aporte',
  SELL: 'Resgate',
  TAX: 'Imposto',
  TRANSFER: 'Transferência',
};

export default function AssetsScreen() {
  const { colors, radius, shadows } = useTheme();
  const { data: portfolio, loading, error, reload } = usePortfolio();
  const { wallet, reload: reloadWallet } = useInvestments();
  const [refreshing, setRefreshing] = useState(false);

  // Detalhe de um ativo (transações/aportes)
  const [detail, setDetail] = useState<PortfolioItem | null>(null);
  const [movements, setMovements] = useState<PortfolioMovement[] | null>(null);
  const [movLoading, setMovLoading] = useState(false);

  const openDetail = useCallback(async (item: PortfolioItem) => {
    setDetail(item);
    setMovements(null);
    setMovLoading(true);
    try {
      const res = await portfolioService.investmentTransactions(item.id);
      setMovements(res.movements);
    } catch {
      setMovements([]);
    } finally {
      setMovLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([reload(), reloadWallet()]);
    } finally {
      setRefreshing(false);
    }
  }, [reload, reloadWallet]);

  useFocusRefresh(handleRefresh);

  // Junta os grupos do Pluggy (Rico/XP...) com a Binance (cripto).
  const groups: PortfolioGroup[] = useMemo(() => {
    const pluggy = portfolio?.groups ?? [];
    if (wallet?.connected && wallet.assets.length > 0) {
      const binance: PortfolioGroup = {
        source: 'Binance',
        items: wallet.assets.map((a) => ({
          id: a.symbol,
          name: a.name || a.symbol,
          assetClass: 'Cripto',
          quantity: a.quantity,
          investedBrl: null,
          currentBrl: a.valueBRL,
          profitBrl: null,
          profitPct: a.change24h ?? null,
          dayChangePct: null,
          annualRate: null,
          dueDate: null,
        })),
        totals: { invested: 0, current: wallet.totalBRL, profit: 0 },
      };
      return [...pluggy, binance];
    }
    return pluggy;
  }, [portfolio, wallet]);


  const byClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of portfolio?.byClass ?? []) map.set(c.assetClass, c.current);
    if (wallet?.connected && wallet.totalBRL > 0) {
      map.set('Cripto', (map.get('Cripto') ?? 0) + wallet.totalBRL);
    }
    return [...map.entries()].map(([assetClass, current]) => ({ assetClass, current })).sort((a, b) => b.current - a.current);
  }, [portfolio, wallet]);

  // Filtro por classe de ativo
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const allClasses = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) for (const it of g.items) s.add(it.assetClass);
    return [...s];
  }, [groups]);
  const filteredGroups = useMemo(() => {
    const base = !classFilter
      ? groups
      : groups
          .map((g) => ({ ...g, items: g.items.filter((it) => it.assetClass === classFilter) }))
          .filter((g) => g.items.length > 0);
    // Recalcula os totais de cada grupo a partir dos itens filtrados (senão o
    // header da corretora não acompanha o filtro).
    return base.map((g) => ({
      ...g,
      totals: g.items.reduce(
        (t, it) => ({
          invested: t.invested + (it.investedBrl ?? 0),
          current: t.current + it.currentBrl,
          profit: t.profit + (it.profitBrl ?? 0),
        }),
        { invested: 0, current: 0, profit: 0 }
      ),
    }));
  }, [groups, classFilter]);

  const shownTotals = useMemo(
    () =>
      filteredGroups.reduce(
        (t, g) => ({
          invested: t.invested + g.totals.invested,
          current: t.current + g.totals.current,
          profit: t.profit + g.totals.profit,
        }),
        { invested: 0, current: 0, profit: 0 }
      ),
    [filteredGroups]
  );
  const totalCurrent = shownTotals.current;
  const totalInvested = shownTotals.invested;
  const totalProfit = shownTotals.profit;

  if (error) {
    return (
      <TabScreenScroll refreshing={false} onRefresh={handleRefresh}>
        <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Ativos</Text>
        <ErrorState subtitle={error} onRetry={reload} />
      </TabScreenScroll>
    );
  }

  return (
    <TabScreenScroll refreshing={refreshing} loading={loading && groups.length === 0} onRefresh={handleRefresh}>
      <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Ativos</Text>

      {groups.length === 0 ? (
        loading ? (
          <ListSkeleton />
        ) : (
          <EmptyState
            title="Nenhum ativo ainda"
            subtitle="Conecte uma corretora (Rico, XP...) pelo MeuPluggy ou a Binance pra ver sua carteira aqui."
          />
        )
      ) : (
        <>
          {/* Patrimônio total */}
          <View style={[styles.hero, { backgroundColor: colors.brandPrimaryDark, borderRadius: radius.xl, ...shadows.glow }]}>
            <Text style={styles.heroLabel}>Patrimônio investido</Text>
            <Text style={styles.heroValue}>{formatCurrency(totalCurrent)}</Text>
            {totalInvested > 0 ? (
              <Text style={styles.heroSub}>
                Aplicado {formatCurrency(totalInvested)} · {totalProfit >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totalProfit))}
                {totalInvested > 0 ? ` (${((totalProfit / totalInvested) * 100).toFixed(1)}%)` : ''}
              </Text>
            ) : null}
            {!classFilter && portfolio?.variation ? (
              portfolio.variation.dayPct != null || portfolio.variation.monthPct != null ? (
                <Text style={styles.heroSub}>
                  {portfolio.variation.dayPct != null ? `Hoje ${portfolio.variation.dayPct >= 0 ? '+' : ''}${portfolio.variation.dayPct.toFixed(2)}%` : ''}
                  {portfolio.variation.dayPct != null && portfolio.variation.monthPct != null ? '  ·  ' : ''}
                  {portfolio.variation.monthPct != null ? `Mês ${portfolio.variation.monthPct >= 0 ? '+' : ''}${portfolio.variation.monthPct.toFixed(2)}%` : ''}
                </Text>
              ) : (
                <Text style={[styles.heroSub, { opacity: 0.65 }]}>Valorização: juntando histórico…</Text>
              )
            ) : null}
          </View>

          {/* Alocação por classe (só na visão geral) */}
          {!classFilter && byClass.length > 0 ? (
            <View style={[styles.card, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
              <Text style={[styles.cardTitle, { color: colors.brandTextSecondary }]}>Alocação</Text>
              {byClass.map((c) => {
                const pct = totalCurrent > 0 ? (c.current / totalCurrent) * 100 : 0;
                return (
                  <View key={c.assetClass} style={styles.allocRow}>
                    <Text style={[styles.allocClass, { color: colors.brandTextPrimary }]} numberOfLines={1}>{c.assetClass}</Text>
                    <View style={[styles.allocBarTrack, { backgroundColor: colors.brandDivider }]}>
                      <View style={[styles.allocBarFill, { width: `${Math.min(100, pct)}%`, backgroundColor: colors.brandPrimaryDark }]} />
                    </View>
                    <Text style={[styles.allocPct, { color: colors.brandTextSecondary }]}>{pct.toFixed(0)}%</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {allClasses.length > 1 ? (
            <View style={styles.filterRow}>
              <ClassPill label="Todos" active={!classFilter} onPress={() => setClassFilter(null)} colors={colors} />
              {allClasses.map((c) => (
                <ClassPill key={c} label={c} active={classFilter === c} onPress={() => setClassFilter(c)} colors={colors} />
              ))}
            </View>
          ) : null}

          {/* Grupos por instituição */}
          {filteredGroups.map((g) => (
            <View key={g.source} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupName, { color: colors.brandTextPrimary }]}>{g.source}</Text>
                <Text style={[styles.groupTotal, { color: colors.brandTextPrimary }]}>{formatCurrency(g.totals.current)}</Text>
              </View>
              <View style={[styles.list, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
                {g.items.map((it, i) => {
                  const tappable = g.source !== 'Binance';
                  return (
                  <Pressable
                    key={it.id}
                    onPress={tappable ? () => openDetail(it) : undefined}
                    style={({ pressed }) => [
                      styles.row,
                      i < g.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.brandDivider },
                      pressed && tappable && { opacity: 0.6 },
                    ]}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={[styles.itemName, { color: colors.brandTextPrimary }]} numberOfLines={1}>{it.name}</Text>
                      <Text style={[styles.itemClass, { color: colors.brandTextSecondary }]}>{it.assetClass}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.itemValue, { color: colors.brandTextPrimary }]}>{formatCurrency(it.currentBrl)}</Text>
                      {it.profitBrl != null ? (
                        <Text style={{ fontSize: 12, fontWeight: '700', color: it.profitBrl >= 0 ? colors.brandTextPositive : colors.brandTextNegative }}>
                          {it.profitBrl >= 0 ? '+' : '-'}{formatCurrency(Math.abs(it.profitBrl))}
                          {it.profitPct != null ? ` (${it.profitBrl >= 0 ? '+' : '-'}${Math.abs(it.profitPct).toFixed(1)}%)` : ''}
                        </Text>
                      ) : it.dayChangePct != null ? (
                        <Text style={{ fontSize: 12, fontWeight: '700', color: it.dayChangePct >= 0 ? colors.brandTextPositive : colors.brandTextNegative }}>
                          hoje {it.dayChangePct >= 0 ? '+' : ''}{it.dayChangePct.toFixed(2)}%
                        </Text>
                      ) : it.profitPct != null ? (
                        <Text style={{ fontSize: 12, fontWeight: '700', color: it.profitPct >= 0 ? colors.brandTextPositive : colors.brandTextNegative }}>
                          24h {it.profitPct >= 0 ? '+' : ''}{it.profitPct.toFixed(2)}%
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </>
      )}

      {detail ? (
        <BottomSheet onClose={() => setDetail(null)} maxHeightFraction={0.75} asNativeModal>
          <Text style={[styles.sheetTitle, { color: colors.brandTextPrimary }]}>{detail.name}</Text>
          <Text style={[styles.sheetSub, { color: colors.brandTextSecondary }]}>
            {detail.assetClass} · {formatCurrency(detail.currentBrl)}
            {detail.quantity != null ? ` · ${detail.quantity} cota${detail.quantity === 1 ? '' : 's'}` : ''}
          </Text>

          {movLoading ? (
            <View style={{ paddingVertical: 28, alignItems: 'center' }}>
              <LoadingDog size={32} color={colors.brandPrimaryDark} />
            </View>
          ) : movements && movements.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              {movements.map((m, i) => {
                const isOut = m.type === 'SELL' || m.type === 'TAX';
                return (
                  <View
                    key={m.id || `${m.date}-${i}`}
                    style={[
                      styles.movRow,
                      i < movements.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.brandDivider },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.movType, { color: colors.brandTextPrimary }]}>{MOVEMENT_LABEL[m.type] ?? m.type}</Text>
                      {m.date ? <Text style={[styles.movDate, { color: colors.brandTextSecondary }]}>{formatDate(m.date)}</Text> : null}
                    </View>
                    <Text style={{ fontWeight: '800', fontSize: 14, color: isOut ? colors.brandTextNegative : colors.brandTextPositive }}>
                      {isOut ? '-' : '+'}{formatCurrency(m.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.sheetEmpty, { color: colors.brandTextSecondary }]}>
              Sem movimentos pra mostrar (a corretora pode não ter enviado o histórico).
            </Text>
          )}
        </BottomSheet>
      ) : null}
    </TabScreenScroll>
  );
}

function ClassPill({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: active ? colors.brandPillBgActive : colors.brandPillBg,
          borderColor: active ? colors.brandPrimary : colors.brandDivider,
        },
      ]}
    >
      <Text style={[styles.pillText, { color: active ? colors.brandPrimaryDark : colors.brandTextSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '700' },
  hero: { padding: 22, marginBottom: 16 },
  heroLabel: { color: '#FFFFFF', opacity: 0.85, fontSize: 13, fontWeight: '600' },
  heroValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', marginTop: 6 },
  heroSub: { color: '#FFFFFF', opacity: 0.85, fontSize: 12, fontWeight: '600', marginTop: 8 },
  card: { padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  allocRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  allocClass: { width: 96, fontSize: 13, fontWeight: '700' },
  allocBarTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  allocBarFill: { height: '100%' },
  allocPct: { width: 38, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  group: { marginBottom: 16 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, paddingHorizontal: 4 },
  groupName: { fontSize: 16, fontWeight: '800' },
  groupTotal: { fontSize: 16, fontWeight: '900' },
  list: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemClass: { fontSize: 12, marginTop: 2 },
  itemValue: { fontSize: 15, fontWeight: '800' },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sheetSub: { fontSize: 13, fontWeight: '600', marginBottom: 12 },
  sheetEmpty: { fontSize: 14, lineHeight: 20, marginTop: 12 },
  movRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  movType: { fontSize: 14, fontWeight: '700' },
  movDate: { fontSize: 12, marginTop: 2 },
});
