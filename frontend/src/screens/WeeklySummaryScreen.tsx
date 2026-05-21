import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';
import { analyticsService, WeeklySummary } from '@/services/analytics.service';
import { formatCurrency } from '@/lib/formatters';
import { normalizeError } from '@/lib/errorMap';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { dogRefreshControl, DogRefreshOverlay } from '@/ui/DogRefresh';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';

export default function WeeklySummaryScreen() {
  const { colors, radius, shadows } = useTheme();
  const [data, setData] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    mode === 'refresh' ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setData(await analyticsService.weeklySummary());
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Screen style={styles.padded}>
        <ScreenHeader title="Resumo da semana" />
        <LoadingState />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen style={styles.padded}>
        <ScreenHeader title="Resumo da semana" />
        <ErrorState subtitle={error || undefined} onRetry={() => load()} />
      </Screen>
    );
  }

  const period = `${format(new Date(data.startDate), "dd 'de' MMM", { locale: ptBR })} → ${format(new Date(data.endDate), "dd 'de' MMM", { locale: ptBR })}`;
  const positive = data.net >= 0;

  return (
    <Screen style={styles.padded}>
      <ScreenHeader title="Resumo da semana" />
      <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={dogRefreshControl(refreshing, () => load('refresh'))}
      >
        <View style={[styles.hero, { backgroundColor: colors.brandPrimaryDark, borderRadius: radius.xl, ...shadows.glow }]}>
          <Text style={styles.heroPeriod}>{period}</Text>
          <Text style={styles.heroLabel}>Saldo da semana</Text>
          <Text style={styles.heroNet}>{positive ? '+' : '-'}{formatCurrency(Math.abs(data.net))}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
            <Text style={[styles.statLabel, { color: colors.brandTextSecondary }]}>Entrou</Text>
            <Text style={[styles.statValue, { color: colors.brandTextPositive }]}>+{formatCurrency(data.income)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
            <Text style={[styles.statLabel, { color: colors.brandTextSecondary }]}>Saiu</Text>
            <Text style={[styles.statValue, { color: colors.brandTextNegative }]}>-{formatCurrency(data.expense)}</Text>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.brandTextSecondary }]}>Onde você gastou</Text>
        {data.topCategories.length === 0 ? (
          <EmptyState title="Sem gastos na semana" subtitle="Nenhuma despesa nos últimos 7 dias." />
        ) : (
          <View style={[styles.list, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
            {data.topCategories.map((c, i) => (
              <View
                key={c.categoryId}
                style={[
                  styles.catRow,
                  i < data.topCategories.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.brandDivider },
                ]}
              >
                <CategoryIcon icon={c.categoryIcon} color={c.categoryColor || colors.brandPrimary} size={20} />
                <Text style={[styles.catName, { color: colors.brandTextPrimary }]} numberOfLines={1}>{c.categoryName}</Text>
                <Text style={[styles.catValue, { color: colors.brandTextPrimary }]}>{formatCurrency(c.total)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <DogRefreshOverlay refreshing={refreshing} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16 },
  hero: { padding: 22, marginBottom: 14 },
  heroPeriod: { color: '#FFFFFF', opacity: 0.8, fontSize: 12, fontWeight: '600' },
  heroLabel: { color: '#FFFFFF', opacity: 0.85, fontSize: 13, fontWeight: '600', marginTop: 8 },
  heroNet: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, padding: 16 },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 18, fontWeight: '900', marginTop: 6 },
  section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6, marginBottom: 10, paddingLeft: 4 },
  list: { overflow: 'hidden' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  catName: { flex: 1, fontSize: 14, fontWeight: '700' },
  catValue: { fontSize: 14, fontWeight: '800' },
});
