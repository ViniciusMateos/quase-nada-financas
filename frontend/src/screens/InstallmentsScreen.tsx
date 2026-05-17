import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { normalizeError } from '@/lib/errorMap';
import { analyticsService, InstallmentsResponse } from '@/services/analytics.service';
import { EmptyState, ErrorState, Skeleton } from '@/ui/States';
import { TabScreen } from '@/ui/TabScreen';

export default function InstallmentsScreen() {
  const { colors, radius, shadows } = useTheme();
  const [data, setData] = useState<InstallmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    mode === 'refresh' ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await analyticsService.installments();
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
  }, [load]);

  if (loading) {
    return (
      <TabScreen>
        <Skeleton height={140} />
        <Skeleton /><Skeleton /><Skeleton />
      </TabScreen>
    );
  }

  if (error) {
    return (
      <TabScreen>
        <ErrorState subtitle={error} onRetry={() => load()} />
      </TabScreen>
    );
  }

  const items = data?.items ?? [];
  const totals = data?.totals ?? { paid: 0, remaining: 0, count: 0 };

  return (
    <TabScreen>
      <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Parcelamentos</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={colors.brandPrimaryDark} />
        }
      >
        <View style={[styles.summaryCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
          <View style={styles.summaryRow}>
            <SummaryCell label="Ativos" value={`${totals.count}`} colors={colors} />
            <SummaryCell label="Pago" value={formatCurrency(totals.paid)} colors={colors} accent />
            <SummaryCell label="A pagar" value={formatCurrency(totals.remaining)} colors={colors} warning />
          </View>
        </View>

        {items.length === 0 ? (
          <EmptyState
            title="Nenhuma compra parcelada"
            subtitle="Quando você comprar parcelado, aparece aqui o progresso de cada uma."
          />
        ) : (
          items.map((it) => (
            <View
              key={it.id}
              style={[styles.card, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 92, 117, 0.15)' }]}>
                  <Ionicons name="card-outline" size={20} color={colors.brandError} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.descLabel, { color: colors.brandTextPrimary }]} numberOfLines={2}>
                    {it.description}
                  </Text>
                  <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>
                    Parcela {it.installmentCurrent}/{it.installmentTotal} · iniciada {formatDate(it.occurredAt)}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={[styles.amount, { color: colors.brandTextPrimary }]}>
                    {formatCurrency(it.installmentAmount)}
                  </Text>
                  <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>/mês</Text>
                </View>
              </View>

              <View style={[styles.barTrack, { backgroundColor: colors.brandDivider }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${it.progress}%`, backgroundColor: colors.brandPrimaryDark },
                  ]}
                />
              </View>

              <View style={styles.footer}>
                <View>
                  <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>Pago</Text>
                  <Text style={[styles.footerValue, { color: colors.brandTextPositive }]}>
                    {formatCurrency(it.paidAmount)}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>Total</Text>
                  <Text style={[styles.footerValue, { color: colors.brandTextPrimary }]}>
                    {formatCurrency(it.totalAmount)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>A pagar</Text>
                  <Text style={[styles.footerValue, { color: colors.brandTextNegative }]}>
                    {formatCurrency(it.remainingAmount)}
                  </Text>
                </View>
              </View>

              {it.estimatedLastDate ? (
                <Text style={[styles.lastDate, { color: colors.brandTextSecondary }]}>
                  Última parcela em {formatDate(it.estimatedLastDate)}
                </Text>
              ) : (
                <Text style={[styles.lastDate, { color: colors.brandTextPositive, fontWeight: '700' }]}>
                  Quitada ✓
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </TabScreen>
  );
}

function SummaryCell({
  label,
  value,
  colors,
  accent,
  warning,
}: {
  label: string;
  value: string;
  colors: any;
  accent?: boolean;
  warning?: boolean;
}) {
  const valueColor = warning ? colors.brandTextNegative : accent ? colors.brandTextPositive : colors.brandTextPrimary;
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryLabel, { color: colors.brandTextSecondary }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  summaryCard: { padding: 16, marginBottom: 16 },
  summaryRow: { flexDirection: 'row' },
  summaryCell: { flex: 1 },
  summaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  summaryValue: { fontSize: 17, fontWeight: '900' },
  card: { padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  descLabel: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 3 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '900' },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 10 },
  barFill: { height: '100%' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  footerValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  lastDate: { fontSize: 11, marginTop: 10, textAlign: 'right', fontWeight: '600' },
});
