import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataRefreshKey } from '@/contexts/DataRefreshContext';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { normalizeError } from '@/lib/errorMap';
import { analyticsService, SubscriptionsResponse } from '@/services/analytics.service';
import { EmptyState, ErrorState, ListSkeleton } from '@/ui/States';
import { dogRefreshControl, DogRefreshHeader } from '@/ui/DogRefresh';
import { TabScreen } from '@/ui/TabScreen';

export default function SubscriptionsScreen() {
  const { colors, radius, shadows } = useTheme();
  const [data, setData] = useState<SubscriptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshKey = useDataRefreshKey();

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    mode === 'refresh' ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await analyticsService.subscriptions();
      setData(res);
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useFocusRefresh(() => load('refresh'));

  if (error) {
    return (
      <TabScreen>
        <ErrorState subtitle={error} onRetry={() => load()} />
      </TabScreen>
    );
  }

  const items = data?.items ?? [];
  const totals = data?.totals ?? { activeCount: 0, monthlyTotal: 0, yearlyProjection: 0, averagePerService: 0 };

  return (
    <TabScreen>
      <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Assinaturas</Text>
      <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={dogRefreshControl(refreshing, () => load('refresh'))}
      >
        <DogRefreshHeader refreshing={loading || refreshing} />
        {loading && !data ? (
          <ListSkeleton />
        ) : (
          <>
        <View style={[styles.summaryCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
          <View style={styles.summaryRow}>
            <SummaryCell label="Ativas" value={`${totals.activeCount}`} hint="recorrentes" colors={colors} />
            <SummaryCell label="Gasto mensal" value={formatCurrency(totals.monthlyTotal)} colors={colors} accent />
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.brandDivider }]} />
          <View style={styles.summaryRow}>
            <SummaryCell label="Projeção anual" value={formatCurrency(totals.yearlyProjection)} colors={colors} warning />
            <SummaryCell label="Média/serviço" value={formatCurrency(totals.averagePerService)} colors={colors} />
          </View>
        </View>

        {items.length === 0 ? (
          <EmptyState
            title="Nenhuma assinatura detectada"
            subtitle="A gente busca pagamentos recorrentes do mesmo valor nos últimos 6 meses."
          />
        ) : (
          <View style={[styles.list, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
            {items.map((sub, i) => (
              <View
                key={sub.key}
                style={[
                  styles.row,
                  i < items.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.brandDivider,
                  },
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.brandPrimaryTint }]}>
                  <Text style={[styles.iconText, { color: colors.brandPrimaryDark }]}>
                    {sub.label.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.middle}>
                  <Text style={[styles.subLabel, { color: colors.brandTextPrimary }]} numberOfLines={1}>
                    {sub.label}
                  </Text>
                  <Text style={[styles.subMeta, { color: colors.brandTextSecondary }]}>
                    Próxima: {formatDate(sub.nextDate)} · {sub.occurrences} pagamentos
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={[styles.subAmount, { color: colors.brandTextPrimary }]}>
                    {formatCurrency(sub.monthlyAmount)}
                  </Text>
                  <Text style={[styles.subMeta, { color: colors.brandTextSecondary }]}>/mês</Text>
                </View>
              </View>
            ))}
          </View>
        )}
          </>
        )}
      </ScrollView>
      </View>
    </TabScreen>
  );
}

function SummaryCell({
  label,
  value,
  hint,
  colors,
  accent,
  warning,
}: {
  label: string;
  value: string;
  hint?: string;
  colors: any;
  accent?: boolean;
  warning?: boolean;
}) {
  const valueColor = warning ? colors.brandWarning : accent ? colors.brandTextPositive : colors.brandTextPrimary;
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryLabel, { color: colors.brandTextSecondary }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={[styles.summaryHint, { color: colors.brandTextSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  summaryCard: { padding: 16, marginBottom: 16 },
  summaryRow: { flexDirection: 'row' },
  summaryCell: { flex: 1, paddingVertical: 8 },
  summaryDivider: { height: 1, marginVertical: 4 },
  summaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryHint: { fontSize: 10, marginTop: 2, fontWeight: '600' },
  list: { overflow: 'hidden' },
  row: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 13, fontWeight: '900' },
  middle: { flex: 1 },
  subLabel: { fontSize: 15, fontWeight: '700' },
  subMeta: { fontSize: 11, marginTop: 3, fontWeight: '500' },
  right: { alignItems: 'flex-end' },
  subAmount: { fontSize: 16, fontWeight: '900' },
});
