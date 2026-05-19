import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { formatCurrency } from '@/lib/formatters';
import { normalizeError } from '@/lib/errorMap';
import { analyticsService, CategoryStatsResponse } from '@/services/analytics.service';
import { EmptyState, ErrorState, Skeleton } from '@/ui/States';
import { PeriodPickerSheet } from '@/ui/PeriodPickerSheet';
import { TabScreen } from '@/ui/TabScreen';

export default function CategoriesScreen() {
  const navigation = useNavigation<any>();
  const { colors, radius, shadows } = useTheme();
  const { width: screenW } = useWindowDimensions();

  const [monthOffset, setMonthOffset] = useState(0);
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);

  const [data, setData] = useState<CategoryStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const referenceMonth = useMemo(() => addMonths(new Date(), monthOffset), [monthOffset]);
  const monthStart = useMemo(
    () => (customRange ? customRange.start : startOfMonth(referenceMonth)),
    [customRange, referenceMonth]
  );
  const monthEnd = useMemo(
    () => (customRange ? customRange.end : endOfMonth(referenceMonth)),
    [customRange, referenceMonth]
  );
  const monthIso = format(referenceMonth, 'yyyy-MM');
  const monthLabel = useMemo(() => {
    if (customRange) {
      const sameMonth =
        customRange.start.getMonth() === customRange.end.getMonth() &&
        customRange.start.getFullYear() === customRange.end.getFullYear();
      if (sameMonth) {
        return capitalize(format(customRange.start, "LLLL 'de' yyyy", { locale: ptBR }));
      }
      return `${capitalize(format(customRange.start, 'LLL/yy', { locale: ptBR }))} → ${capitalize(
        format(customRange.end, 'LLL/yy', { locale: ptBR })
      )}`;
    }
    return capitalize(format(referenceMonth, "LLLL 'de' yyyy", { locale: ptBR }));
  }, [customRange, referenceMonth]);

  const isCustom = customRange !== null;

  // Slide animation entre meses + skeleton 280ms (mesmo padrão de Transações)
  const translateX = useSharedValue(0);
  const prevOffsetRef = useRef(monthOffset);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (prevOffsetRef.current === monthOffset) return;
    setTransitioning(true);
    const t = setTimeout(() => setTransitioning(false), 280);
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

  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-25, 25])
    .onUpdate((e) => {
      translateX.value = e.translationX * 0.4;
    })
    .onEnd((e) => {
      const triggered = Math.abs(e.translationX) > 60 || Math.abs(e.velocityX) > 600;
      if (!triggered) {
        translateX.value = withSpring(0, { damping: 26, stiffness: 320 });
        return;
      }
      if (e.translationX < 0) {
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

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      mode === 'refresh' ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const res = customRange
          ? await analyticsService.categoryStats({
              startDate: format(monthStart, 'yyyy-MM-dd'),
              endDate: format(monthEnd, 'yyyy-MM-dd'),
            })
          : await analyticsService.categoryStats({ month: monthIso });
        setData(res);
      } catch (err) {
        setError(normalizeError(err).message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [monthIso, monthStart, monthEnd, customRange]
  );

  useEffect(() => {
    load();
  }, [load]);

  useFocusRefresh(() => load('refresh'));

  if (loading && !data) {
    return (
      <TabScreen>
        <Skeleton height={120} />
        <Skeleton />
        <Skeleton />
        <Skeleton />
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
  const total = data?.total ?? 0;

  return (
    <TabScreen>
      <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Categorias</Text>

      <GestureDetector gesture={isCustom ? Gesture.Pan().enabled(false) : swipe}>
        <Animated.View
          style={[
            styles.monthCard,
            { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card },
            slideStyle,
          ]}
        >
          {isCustom ? (
            <Pressable
              onPress={() => setCustomRange(null)}
              hitSlop={10}
              style={styles.chevronBtn}
              accessibilityLabel="Limpar período"
            >
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
            <Text style={[styles.monthTotal, { color: colors.brandTextNegative }]}>
              -{formatCurrency(total)}
            </Text>
            <Text style={[styles.monthHint, { color: colors.brandTextSecondary }]}>
              {items.length} categoria{items.length === 1 ? '' : 's'}
            </Text>
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

      {transitioning ? (
        <View style={{ flex: 1, gap: 10, marginTop: 6 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={[styles.skelRow, { backgroundColor: colors.brandSurface, borderRadius: radius.lg }]}
            >
              <View style={[styles.skelCircle, { backgroundColor: colors.brandDivider }]} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={[styles.skelLine, { width: '70%', backgroundColor: colors.brandDivider }]} />
                <View
                  style={[
                    styles.skelLine,
                    { width: '40%', backgroundColor: colors.brandDivider, height: 10 },
                  ]}
                />
              </View>
              <View style={[styles.skelLine, { width: 70, backgroundColor: colors.brandDivider }]} />
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={colors.brandPrimaryDark}
            />
          }
        >
          {items.length === 0 ? (
            <EmptyState
              title="Nenhuma despesa neste período"
              subtitle="Tente outro mês ou sincronize as contas."
            />
          ) : (
            items.map((cat) => (
              <Pressable
                key={cat.categoryId}
                onPress={() =>
                  navigation.navigate('CategoryDetail', {
                    categoryId: cat.categoryId,
                    categoryName: cat.categoryName,
                    categoryIcon: cat.categoryIcon,
                    startDate: format(monthStart, 'yyyy-MM-dd'),
                    endDate: format(monthEnd, 'yyyy-MM-dd'),
                    rangeLabel: monthLabel,
                  })
                }
                style={({ pressed }) => [
                  styles.catCard,
                  { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.catRow}>
                  <CategoryIcon icon={cat.categoryIcon} color={cat.categoryColor || colors.brandPrimary} size={24} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.catName, { color: colors.brandTextPrimary }]} numberOfLines={1}>
                      {cat.categoryName}
                    </Text>
                    <Text style={[styles.catMeta, { color: colors.brandTextSecondary }]}>
                      {cat.transactionsCount} transaç{cat.transactionsCount === 1 ? 'ão' : 'ões'}
                    </Text>
                  </View>
                  <View style={styles.catRight}>
                    <Text style={[styles.catTotal, { color: colors.brandTextPrimary }]}>
                      {formatCurrency(cat.totalSpent)}
                    </Text>
                    <Text style={[styles.catPct, { color: colors.brandTextSecondary }]}>
                      {cat.percentage}%
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.brandTextSecondary}
                    style={{ marginLeft: 6 }}
                  />
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.brandDivider }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.min(100, cat.percentage)}%`,
                        backgroundColor: cat.categoryColor ?? colors.brandPrimaryDark,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </TabScreen>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  monthCard: { padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  chevronBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthInfo: { flex: 1, alignItems: 'center' },
  monthLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  monthTotal: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  monthHint: { fontSize: 11, marginTop: 2 },
  catCard: { padding: 14, marginBottom: 10 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  catIconText: { fontSize: 20 },
  catName: { fontSize: 15, fontWeight: '700' },
  catMeta: { fontSize: 11, marginTop: 3 },
  catRight: { alignItems: 'flex-end' },
  catTotal: { fontSize: 15, fontWeight: '900' },
  catPct: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  barTrack: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  barFill: { height: '100%' },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  skelCircle: { width: 44, height: 44, borderRadius: 22 },
  skelLine: { height: 13, borderRadius: 4 },
});
