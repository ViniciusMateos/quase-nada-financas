import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { formatCurrency } from '@/lib/formatters';
import { normalizeError } from '@/lib/errorMap';
import { transactionsService } from '@/services/transactions.service';
import { TransactionCard } from '@/ui/Cards';
import { EmptyState, ErrorState } from '@/ui/States';
import { LoadingDog } from '@/ui/LoadingDog';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import type { Transaction } from '@/types/api.types';

export default function CategoryDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors, radius, shadows } = useTheme();
  const {
    categoryId,
    categoryName = 'Categoria',
    categoryIcon = null,
    categoryColor = null,
    startDate: routeStart,
    endDate: routeEnd,
    rangeLabel,
    month: routeMonth,
  } = route.params ?? {};

  // Aceita range custom (startDate/endDate) OU mês (month=yyyy-MM).
  // parseISO trata yyyy-MM-dd como data LOCAL — sem bug de timezone.
  const { monthStart, monthEnd, monthLabel } = useMemo(() => {
    if (typeof routeStart === 'string' && typeof routeEnd === 'string') {
      const start = parseISO(routeStart);
      const end = parseISO(routeEnd);
      const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
      const label =
        typeof rangeLabel === 'string'
          ? rangeLabel
          : sameMonth
          ? capitalize(format(start, "LLLL 'de' yyyy", { locale: ptBR }))
          : `${capitalize(format(start, 'LLL/yy', { locale: ptBR }))} → ${capitalize(format(end, 'LLL/yy', { locale: ptBR }))}`;
      return { monthStart: start, monthEnd: end, monthLabel: label };
    }
    const monthIso = typeof routeMonth === 'string' ? routeMonth : format(new Date(), 'yyyy-MM');
    const [y, m] = monthIso.split('-').map(Number);
    const ref = new Date(y, m - 1, 1);
    return {
      monthStart: startOfMonth(ref),
      monthEnd: endOfMonth(ref),
      monthLabel: capitalize(format(ref, "LLLL 'de' yyyy", { locale: ptBR })),
    };
  }, [routeStart, routeEnd, rangeLabel, routeMonth]);

  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await transactionsService.list({
        categoryId,
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd'),
        limit: 100,
      } as any);
      setItems((res as any).items ?? []);
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setLoading(false);
    }
  }, [categoryId, monthStart, monthEnd]);

  useEffect(() => {
    load();
  }, [load]);

  // Total = soma só dos gastos (amount < 0), igual à convenção do backend
  // (getCategoryStats). Estornos/créditos aparecem em separado pra não inflar.
  const { spent, refunded, expenseCount } = useMemo(() => {
    let s = 0;
    let r = 0;
    let ec = 0;
    for (const tx of items) {
      if (tx.amount < 0) {
        s += Math.abs(tx.amount);
        ec++;
      } else if (tx.amount > 0) {
        r += tx.amount;
      }
    }
    return { spent: s, refunded: r, expenseCount: ec };
  }, [items]);

  return (
    <Screen style={styles.padded}>
      <ScreenHeader title="Categoria" />

      <View
        style={[
          styles.hero,
          { backgroundColor: colors.brandSurface, borderRadius: radius.xl, ...shadows.card },
        ]}
      >
        <CategoryIcon icon={categoryIcon} color={categoryColor || colors.brandPrimary} size={36} />
        <Text style={[styles.heroName, { color: colors.brandTextPrimary }]} numberOfLines={1}>
          {categoryName}
        </Text>
        <Text style={[styles.heroSub, { color: colors.brandTextSecondary }]}>{monthLabel}</Text>
        <Text style={[styles.heroTotal, { color: colors.brandTextNegative }]}>
          -{formatCurrency(spent)}
        </Text>
        <Text style={[styles.heroSub, { color: colors.brandTextSecondary }]}>
          {expenseCount} transaç{expenseCount === 1 ? 'ão' : 'ões'}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <LoadingDog size={48} color={colors.brandPrimaryDark} />
          </View>
        ) : error ? (
          <ErrorState subtitle={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState title="Sem transações" subtitle={`Nada nesta categoria em ${monthLabel}.`} />
        ) : (
          <View style={[styles.list, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
            {items.map((tx, i) => (
              <TransactionCard
                key={tx.id}
                item={tx}
                isFirst={i === 0}
                isLast={i === items.length - 1}
                onPress={() => navigation.navigate('TransactionDetail', { transaction: tx })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16 },
  hero: { padding: 22, alignItems: 'center', marginBottom: 16 },
  iconBig: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  iconBigText: { fontSize: 30 },
  heroName: { fontSize: 18, fontWeight: '800' },
  heroSub: { fontSize: 12, marginTop: 4 },
  heroTotal: { fontSize: 30, fontWeight: '900', marginTop: 8 },
  heroRefund: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  list: { overflow: 'hidden' },
});
