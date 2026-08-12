import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { addMonths, endOfMonth, format, isWithinInterval, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useForegroundRefresh } from '@/hooks/useForegroundRefresh';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/lib/formatters';
import { accountsService } from '@/services/accounts.service';
import { transactionsService, TransactionsSummary } from '@/services/transactions.service';
import { TransactionCard } from '@/ui/Cards';
import { LoadingDog } from '@/ui/LoadingDog';
import { EmptyState, ErrorState, ListSkeleton } from '@/ui/States';
import { dogRefreshControl, DogRefreshHeader } from '@/ui/DogRefresh';
import { PeriodPickerSheet } from '@/ui/PeriodPickerSheet';
import { TabScreen } from '@/ui/TabScreen';
import type { Transaction } from '@/types/api.types';

type TypeFilter = 'all' | 'income' | 'expense';
type SourceFilter = 'all' | 'BANK' | 'CREDIT';

export default function TransactionsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, radius, shadows } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const { items, loading, loadingMore, error, reload, loadMore, setFilters } = useTransactions({});
  const { items: accounts } = useAccounts();

  // Sem reload no foco: voltar de uma transação NÃO recarrega a lista (mantém
  // scroll e paginação). Mutações reais (editar/sincronizar) já refetcham via
  // DataRefreshContext.bump(); frescor também vem do pull-to-refresh e foreground.

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  // Filtro por instituição (ConnectedAccount.id). Selecionar uma pill envia accountIds = bankAccounts daquela conexão.
  const [accountFilter, setAccountFilter] = useState<string | null>(route.params?.accountId ?? null);
  const [refreshing, setRefreshing] = useState(false);

  // Re-aplica o filtro a cada toque numa conta na aba Contas. O _ts muda em todo
  // toque, então re-filtra mesmo tocando a mesma conta (a aba fica montada e o
  // useState inicial só roda uma vez).
  useEffect(() => {
    if (route.params?.accountId !== undefined) setAccountFilter(route.params.accountId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?._ts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled((accounts ?? []).map((acc) => accountsService.sync(acc.id)));
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [accounts, reload]);

  useForegroundRefresh(handleRefresh);

  const selectedBankAccountIds = useMemo(() => {
    if (!accountFilter) return undefined;
    const conn = accounts?.find((a) => a.id === accountFilter);
    const ids = conn?.bankAccounts?.map((b) => b.id) ?? [];
    return ids.length > 0 ? ids : undefined;
  }, [accountFilter, accounts]);

  useEffect(() => {
    setFilters({
      accountIds: selectedBankAccountIds,
      accountType: sourceFilter === 'all' ? undefined : sourceFilter,
    });
  }, [selectedBankAccountIds, sourceFilter, setFilters]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Slide animation entre meses
  const translateX = useSharedValue(0);
  const prevOffsetRef = useRef(monthOffset);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (prevOffsetRef.current === monthOffset) return;
    // Mostra skeleton list pra liberar o JS thread e a animação rodar fluida
    setTransitioning(true);
    const t = setTimeout(() => setTransitioning(false), 280);
    // monthOffset diminuiu = mês anterior → conteúdo entra pela ESQUERDA
    // monthOffset aumentou = mês seguinte → conteúdo entra pela DIREITA
    const direction = monthOffset < prevOffsetRef.current ? -1 : 1;
    translateX.value = direction * screenW * 0.18;
    translateX.value = withSpring(0, { damping: 26, stiffness: 320, mass: 0.6 });
    prevOffsetRef.current = monthOffset;
    return () => clearTimeout(t);
  }, [monthOffset, screenW, translateX]);

  function changeMonth(delta: number) {
    if (delta > 0 && monthOffset >= 0) return;
    setMonthOffset((v) => v + delta);
  }

  // Swipe gesture pra trocar mês
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-25, 25])
    .onUpdate((e) => {
      // resistência: amortece em ~40% pra sentir o limite
      translateX.value = e.translationX * 0.4;
    })
    .onEnd((e) => {
      const triggered =
        Math.abs(e.translationX) > 60 || Math.abs(e.velocityX) > 600;
      if (!triggered) {
        translateX.value = withSpring(0, { damping: 26, stiffness: 320 });
        return;
      }
      if (e.translationX < 0) {
        // Esquerda → mês seguinte (só se permitido)
        if (monthOffset < 0) {
          runOnJS(setMonthOffset)(monthOffset + 1);
        } else {
          translateX.value = withSpring(0, { damping: 26, stiffness: 320 });
        }
      } else {
        runOnJS(setMonthOffset)(monthOffset - 1);
      }
    });

  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const referenceMonth = useMemo(() => addMonths(new Date(), monthOffset), [monthOffset]);
  const monthStart = useMemo(
    () => (customRange ? customRange.start : startOfMonth(referenceMonth)),
    [customRange, referenceMonth]
  );
  const monthEnd = useMemo(
    () => (customRange ? customRange.end : endOfMonth(referenceMonth)),
    [customRange, referenceMonth]
  );
  const monthLabel = useMemo(() => {
    if (customRange) {
      const sameMonth = customRange.start.getMonth() === customRange.end.getMonth() &&
        customRange.start.getFullYear() === customRange.end.getFullYear();
      if (sameMonth) {
        return capitalize(format(customRange.start, "LLLL 'de' yyyy", { locale: ptBR }));
      }
      return `${capitalize(format(customRange.start, 'LLL/yy', { locale: ptBR }))} → ${capitalize(format(customRange.end, 'LLL/yy', { locale: ptBR }))}`;
    }
    return capitalize(format(referenceMonth, "LLLL 'de' yyyy", { locale: ptBR }));
  }, [customRange, referenceMonth]);

  const isCustom = customRange !== null;

  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const allowedBankAccountIds = selectedBankAccountIds ? new Set(selectedBankAccountIds) : null;
    return items.filter((tx) => {
      if (typeFilter === 'income' && tx.amount <= 0) return false;
      if (typeFilter === 'expense' && tx.amount >= 0) return false;
      if (allowedBankAccountIds && (!tx.accountId || !allowedBankAccountIds.has(tx.accountId))) return false;
      const txDate = new Date(tx.occurredAt);
      if (!Number.isNaN(txDate.getTime()) && !isWithinInterval(txDate, { start: monthStart, end: monthEnd })) {
        return false;
      }
      if (searchLower) {
        const haystack = `${tx.description ?? ''} ${tx.categoryName ?? ''} ${tx.accountName ?? ''}`.toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      return true;
    });
  }, [items, typeFilter, selectedBankAccountIds, monthStart, monthEnd, search]);

  // Resumo do MÊS INTEIRO vem do backend (não depende das transações paginadas)
  const [summary, setSummary] = useState<TransactionsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setSummaryLoading(true);
    transactionsService
      .summary({
        startDate: format(monthStart, 'yyyy-MM-dd'),
        endDate: format(monthEnd, 'yyyy-MM-dd'),
        accountIds: selectedBankAccountIds?.join(','),
        accountType: sourceFilter === 'all' ? undefined : sourceFilter,
      })
      .then((res) => {
        if (alive) setSummary(res);
      })
      .catch(() => {
        if (alive) setSummary(null);
      })
      .finally(() => {
        if (alive) setSummaryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [monthStart, monthEnd, accountFilter, sourceFilter]);

  const monthSummary = useMemo(() => {
    if (summary) return summary;
    // Fallback: enquanto carrega, calcula com o que tem em memória
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      if (tx.amount >= 0) income += tx.amount;
      else expense += Math.abs(tx.amount);
    }
    return { income, expense, net: income - expense, count: filtered.length };
  }, [summary, filtered]);

  const sections = useMemo(() => groupByDay(filtered), [filtered]);

  if (error) {
    return (
      <TabScreen>
        <ErrorState subtitle={error} onRetry={reload} />
      </TabScreen>
    );
  }

  return (
    <TabScreen>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Transações</Text>
        <Pressable
          onPress={() => setSearchOpen((v) => !v)}
          hitSlop={10}
          style={[styles.iconBtn, { backgroundColor: colors.brandSurface, borderColor: colors.brandDivider }]}
        >
          <Ionicons name={searchOpen ? 'close' : 'search'} size={18} color={colors.brandTextPrimary} />
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={[styles.searchWrap, { backgroundColor: colors.brandSurface, borderColor: colors.brandDivider, borderRadius: radius.md }]}>
          <Ionicons name="search" size={16} color={colors.brandTextSecondary} />
          <TextInput
            placeholder="Buscar por descrição, categoria, conta"
            placeholderTextColor={colors.brandTextSecondary}
            value={search}
            onChangeText={setSearch}
            autoFocus
            style={[styles.searchInput, { color: colors.brandTextPrimary }]}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.brandTextSecondary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <GestureDetector gesture={isCustom ? Gesture.Pan().enabled(false) : swipe}>
        <Animated.View style={[
          styles.monthCard,
          { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card },
          slideStyle,
        ]}>
          {isCustom ? (
            <Pressable onPress={() => setCustomRange(null)} hitSlop={10} style={styles.chevronBtn} accessibilityLabel="Limpar período">
              <Ionicons name="close" size={20} color={colors.brandTextSecondary} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => changeMonth(-1)}
              hitSlop={10}
              style={styles.chevronBtn}
              accessibilityLabel="Mês anterior"
            >
              <Ionicons name="chevron-back" size={20} color={colors.brandTextSecondary} />
            </Pressable>
          )}
          <Pressable
            onPress={() => setPeriodPickerOpen(true)}
            style={styles.monthInfo}
            accessibilityLabel="Selecionar período"
          >
            <Text style={[styles.monthLabel, { color: colors.brandTextPrimary }]}>{monthLabel}</Text>
            <View style={{ opacity: summaryLoading ? 0.45 : 1 }}>
              {(() => {
                let value: number;
                let isPositive: boolean;
                if (typeFilter === 'income') {
                  value = monthSummary.income;
                  isPositive = true;
                } else if (typeFilter === 'expense') {
                  value = -monthSummary.expense;
                  isPositive = false;
                } else {
                  value = monthSummary.net;
                  isPositive = monthSummary.net >= 0;
                }
                return (
                  <Text
                    style={[
                      styles.monthNet,
                      { color: isPositive ? colors.brandTextPositive : colors.brandTextNegative },
                    ]}
                  >
                    {isPositive ? '+' : '-'}{formatCurrency(Math.abs(value))}
                  </Text>
                );
              })()}
              <Text style={[styles.monthMeta, { color: colors.brandTextSecondary }]}>
                +{formatCurrency(monthSummary.income)} · -{formatCurrency(monthSummary.expense)}
              </Text>
            </View>
          </Pressable>
          {isCustom || monthOffset >= 0 ? (
            <Pressable
              onPress={() => setPeriodPickerOpen(true)}
              hitSlop={10}
              style={styles.chevronBtn}
              accessibilityLabel="Filtrar período"
            >
              <Ionicons name="options-outline" size={20} color={colors.brandTextSecondary} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => changeMonth(1)}
              hitSlop={10}
              style={styles.chevronBtn}
              accessibilityLabel="Mês seguinte"
            >
              <Ionicons name="chevron-forward" size={20} color={colors.brandTextSecondary} />
            </Pressable>
          )}
        </Animated.View>
      </GestureDetector>

      <PeriodPickerSheet
        visible={periodPickerOpen}
        initialStart={monthStart}
        initialEnd={monthEnd}
        onClose={() => setPeriodPickerOpen(false)}
        onApply={(start, end) => setCustomRange({ start, end })}
      />

      <View style={styles.filterRow}>
        <FilterPill label="Todas" active={typeFilter === 'all'} onPress={() => setTypeFilter('all')} />
        <FilterPill
          label="Receitas"
          active={typeFilter === 'income'}
          activeColor={colors.brandTextPositive}
          onPress={() => setTypeFilter('income')}
        />
        <FilterPill
          label="Despesas"
          active={typeFilter === 'expense'}
          activeColor={colors.brandTextNegative}
          onPress={() => setTypeFilter('expense')}
        />
      </View>

      <View style={styles.filterRow}>
        <FilterPill small label="Todas fontes" active={sourceFilter === 'all'} onPress={() => setSourceFilter('all')} />
        <FilterPill small label="Débito" active={sourceFilter === 'BANK'} onPress={() => setSourceFilter('BANK')} />
        <FilterPill small label="Crédito" active={sourceFilter === 'CREDIT'} onPress={() => setSourceFilter('CREDIT')} />
      </View>

      {(accounts ?? []).filter((a) => !a.isInvestment).length > 1 ? (
        <View style={[styles.filterRow, { marginTop: 0 }]}>
          <FilterPill label="Todas as contas" small active={!accountFilter} onPress={() => setAccountFilter(null)} />
          {(accounts ?? []).filter((a) => !a.isInvestment).map((acc) => (
            <FilterPill
              key={acc.id}
              label={acc.customName || acc.bankName}
              small
              active={accountFilter === acc.id}
              onPress={() => setAccountFilter(accountFilter === acc.id ? null : acc.id)}
            />
          ))}
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
      {transitioning ? (
        <View style={{ flex: 1, gap: 10, marginTop: 6 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[styles.skelRow, { backgroundColor: colors.brandSurface, borderRadius: radius.lg }]}>
              <View style={[styles.skelCircle, { backgroundColor: colors.brandDivider }]} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={[styles.skelLine, { width: '70%', backgroundColor: colors.brandDivider }]} />
                <View style={[styles.skelLine, { width: '40%', backgroundColor: colors.brandDivider, height: 10 }]} />
              </View>
              <View style={[styles.skelLine, { width: 70, backgroundColor: colors.brandDivider }]} />
            </View>
          ))}
        </View>
      ) : loading && items.length === 0 ? (
        <ListSkeleton />
      ) : (
      <SectionList
        key={`${accountFilter ?? 'all'}|${sourceFilter}`}
        sections={sections}
        keyExtractor={(item) => item.id}
        extraData={`${typeFilter}|${monthOffset}|${search}`}
        renderItem={({ item, index, section }) => (
          <View
            style={[
              { backgroundColor: colors.brandSurface, overflow: 'hidden' },
              index === 0 && { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
              index === section.data.length - 1 && {
                borderBottomLeftRadius: radius.lg,
                borderBottomRightRadius: radius.lg,
                marginBottom: 14,
              },
            ]}
          >
            <TransactionCard
              item={item}
              isFirst={index === 0}
              isLast={index === section.data.length - 1}
              onPress={() => navigation.navigate('TransactionDetail', { transaction: item })}
            />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.brandBackground }]}>
            <Text style={[styles.sectionTitle, { color: colors.brandTextSecondary }]}>{section.title}</Text>
            <Text
              style={[
                styles.sectionTotal,
                { color: section.total >= 0 ? colors.brandTextPositive : colors.brandTextNegative },
              ]}
            >
              {section.total >= 0 ? '+' : '-'}{formatCurrency(Math.abs(section.total))}
            </Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        onEndReached={() => loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={dogRefreshControl(refreshing, handleRefresh)}
        ListHeaderComponent={<DogRefreshHeader refreshing={refreshing} />}
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma transação"
            subtitle="Tente outro mês ou limpe os filtros."
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ marginVertical: 16, alignItems: 'center' }}><LoadingDog size={32} color={colors.brandPrimaryDark} /></View>
          ) : sections.length > 0 ? (
            <Text style={[styles.footer, { color: colors.brandTextSecondary }]}>· · ·</Text>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
      )}
      </View>
    </TabScreen>
  );
}

function FilterPill({
  label,
  active,
  onPress,
  activeColor,
  small,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeColor?: string;
  small?: boolean;
}) {
  const { colors, mode } = useTheme();
  const accent = activeColor ?? colors.brandPrimaryDark;
  const bg = active ? (mode === 'dark' ? 'rgba(34, 197, 94, 0.14)' : `${accent}22`) : colors.brandPillBg;
  const fg = active ? accent : colors.brandTextSecondary;
  const border = active ? accent : colors.brandDivider;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        small && styles.pillSmall,
        { backgroundColor: bg, borderColor: border },
      ]}
    >
      <Text style={[styles.pillText, small && styles.pillTextSmall, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

type DaySection = { title: string; total: number; data: Transaction[] };

function groupByDay(items: Transaction[]): DaySection[] {
  const map = new Map<string, { title: string; total: number; data: Transaction[] }>();
  for (const tx of items) {
    const d = new Date(tx.occurredAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = format(d, 'yyyy-MM-dd');
    const title = capitalize(format(d, "EEEE, dd 'de' LLLL", { locale: ptBR }));
    const cur = map.get(key) ?? { title, total: 0, data: [] };
    cur.data.push(tx);
    cur.total += tx.amount;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, v]) => v);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  monthCard: { padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  chevronBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthInfo: { flex: 1, alignItems: 'center' },
  monthLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  monthNet: { fontSize: 22, fontWeight: '900', marginTop: 4, textAlign: 'center' },
  monthMeta: { fontSize: 11, marginTop: 2, textAlign: 'center' },
  skelLg: { height: 24, width: 140, borderRadius: 6, marginTop: 6 },
  skelSm: { height: 12, width: 180, borderRadius: 4, marginTop: 6 },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  skelCircle: { width: 44, height: 44, borderRadius: 22 },
  skelLine: { height: 13, borderRadius: 4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  pillSmall: { paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },
  pillTextSmall: { fontSize: 12 },
  sectionHeader: { paddingVertical: 10, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionTotal: { fontSize: 12, fontWeight: '800' },
  footer: { textAlign: 'center', padding: 24, fontSize: 18, letterSpacing: 4 },
});
