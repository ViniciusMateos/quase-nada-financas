import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addMonths, format, getYear, isSameMonth, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';
import { BottomSheet } from '@/ui/BottomSheet';

type Props = {
  visible: boolean;
  selected: Date;
  onClose: () => void;
  onSelect: (month: Date) => void;
  monthsBack?: number;
  monthsForward?: number;
};

/**
 * Seletor de um único mês (sem faixa/range). Toque num mês → seleciona e fecha.
 * Mostra passado e futuro agrupados por ano, com o mês atual destacado.
 */
export function MonthPickerSheet({
  visible,
  selected,
  onClose,
  onSelect,
  monthsBack = 15,
  monthsForward = 12,
}: Props) {
  const { colors, radius } = useTheme();

  const groups = useMemo(() => {
    const base = startOfMonth(new Date());
    const arr: Date[] = [];
    for (let i = monthsForward; i >= -monthsBack; i--) arr.push(addMonths(base, i));
    const map = new Map<number, Date[]>();
    for (const m of arr) {
      const y = getYear(m);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(m);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]); // ano mais recente no topo
  }, [monthsBack, monthsForward]);

  if (!visible) return null;

  return (
    <BottomSheet onClose={onClose} maxHeightFraction={0.85} asNativeModal>
      <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Selecionar mês</Text>
      <Text style={[styles.subtitle, { color: colors.brandPrimaryDark }]}>
        {capitalize(format(selected, "LLLL 'de' yyyy", { locale: ptBR }))}
      </Text>
      <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
        {groups.map(([year, months]) => (
          <View key={year} style={{ marginBottom: 10 }}>
            <Text style={[styles.yearLabel, { color: colors.brandTextSecondary }]}>{year}</Text>
            <View style={styles.grid}>
              {months.map((m) => {
                const isSel = isSameMonth(m, selected);
                const isCurrent = isSameMonth(m, new Date());
                const bg = isSel ? colors.brandPrimaryDark : colors.brandSurfaceAlt;
                const fg = isSel ? '#FFFFFF' : colors.brandTextSecondary;
                return (
                  <Pressable
                    key={m.toISOString()}
                    onPress={() => {
                      onSelect(startOfMonth(m));
                      onClose();
                    }}
                    style={[
                      styles.monthCell,
                      {
                        backgroundColor: bg,
                        borderRadius: radius.md,
                        borderWidth: isCurrent && !isSel ? 1.5 : 0,
                        borderColor: colors.brandPrimaryDark,
                      },
                    ]}
                  >
                    <Text style={{ color: fg, fontSize: 15, fontWeight: '800', textTransform: 'capitalize' }}>
                      {format(m, 'LLL', { locale: ptBR })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  yearLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8, marginLeft: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthCell: { width: '31%', paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
});
