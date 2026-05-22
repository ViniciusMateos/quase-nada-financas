import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataRefreshKey } from '@/contexts/DataRefreshContext';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { normalizeError } from '@/lib/errorMap';
import { analyticsService, Installment, InstallmentsResponse } from '@/services/analytics.service';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { BankIconInline } from '@/ui/BankIconInline';
import { EmptyState, ErrorState, ListSkeleton } from '@/ui/States';
import { dogRefreshControl, DogRefreshHeader } from '@/ui/DogRefresh';
import { TabScreen } from '@/ui/TabScreen';

/** Extrai o nome do banco do rótulo "Nubank ·1234". */
function bankNameOf(accountName?: string | null): string | null {
  if (!accountName) return null;
  return accountName.split('·')[0]?.trim() || null;
}

export default function InstallmentsScreen() {
  const { colors, radius, shadows } = useTheme();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<InstallmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshKey = useDataRefreshKey();

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
  }, [load, refreshKey]);

  useFocusRefresh(() => load('refresh'));

  const openEditor = useCallback(
    (it: Installment) => {
      navigation.navigate('EditTransaction', {
        transaction: {
          id: it.id,
          description: it.description,
          alias: it.alias,
          categoryId: it.categoryId,
          categoryName: it.categoryName,
          categoryIcon: it.categoryIcon,
          categoryColor: it.categoryColor,
          isSubscriptionOverride: it.isSubscriptionOverride,
        },
      });
    },
    [navigation]
  );

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
            <Pressable
              key={it.id}
              onPress={() => openEditor(it)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card },
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.iconBox}>
                  <CategoryIcon icon={it.categoryIcon} color={it.categoryColor || colors.brandPrimary} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.descLabel, { color: colors.brandTextPrimary }]} numberOfLines={2}>
                    {it.alias || it.description}
                  </Text>
                  <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>
                    Parcela {it.installmentCurrent}/{it.installmentTotal} · iniciada {formatDate(it.occurredAt)}
                  </Text>
                  <View style={styles.metaRow}>
                    <BankIconInline bankName={bankNameOf(it.accountName)} size={12} />
                    <Text style={[styles.meta, { color: colors.brandTextSecondary, flex: 1 }]} numberOfLines={1}>
                      {it.accountName || 'Conta'} • {it.categoryName || 'Sem categoria'}
                    </Text>
                  </View>
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
            </Pressable>
          ))
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
  iconBox: { alignItems: 'center', justifyContent: 'center' },
  descLabel: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '900' },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 10 },
  barFill: { height: '100%' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  footerValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  lastDate: { fontSize: 11, marginTop: 10, textAlign: 'right', fontWeight: '600' },
});
