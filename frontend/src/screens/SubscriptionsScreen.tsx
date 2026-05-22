import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataRefreshKey } from '@/contexts/DataRefreshContext';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { normalizeError } from '@/lib/errorMap';
import { analyticsService, Subscription, SubscriptionsResponse } from '@/services/analytics.service';
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

export default function SubscriptionsScreen() {
  const { colors, radius, shadows } = useTheme();
  const navigation = useNavigation<any>();
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

  const openEditor = useCallback(
    (sub: Subscription) => {
      navigation.navigate('EditTransaction', {
        transaction: {
          id: sub.transactionId,
          description: sub.label,
          alias: sub.alias,
          categoryId: sub.categoryId,
          categoryName: sub.categoryName,
          categoryIcon: sub.categoryIcon,
          categoryColor: sub.categoryColor,
          isSubscriptionOverride: sub.isSubscriptionOverride,
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
              <Pressable
                key={sub.key}
                onPress={() => openEditor(sub)}
                style={({ pressed }) => [
                  styles.row,
                  i < items.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.brandDivider,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.iconBox}>
                  <CategoryIcon icon={sub.categoryIcon} color={sub.categoryColor || colors.brandPrimary} size={20} />
                </View>
                <View style={styles.middle}>
                  <Text style={[styles.subLabel, { color: colors.brandTextPrimary }]} numberOfLines={1}>
                    {sub.label}
                  </Text>
                  <View style={styles.metaRow}>
                    <BankIconInline bankName={bankNameOf(sub.accountName)} size={12} />
                    <Text style={[styles.subMeta, { color: colors.brandTextSecondary, flex: 1 }]} numberOfLines={1}>
                      {sub.accountName ? `${sub.accountName} • ` : ''}{sub.categoryName || 'Sem categoria'}
                    </Text>
                  </View>
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
              </Pressable>
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
  iconBox: { alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1 },
  subLabel: { fontSize: 15, fontWeight: '700' },
  subMeta: { fontSize: 11, marginTop: 3, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  right: { alignItems: 'flex-end' },
  subAmount: { fontSize: 16, fontWeight: '900' },
});
