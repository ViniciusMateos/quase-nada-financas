import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addMonths, endOfMonth, format, isSameMonth, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';

type Props = {
  visible: boolean;
  initialStart: Date;
  initialEnd: Date;
  onClose: () => void;
  onApply: (start: Date, end: Date) => void;
  monthsBack?: number;
};

/**
 * Comportamento da seleção (2 cliques):
 *   1) primeiro toque: marca start = end = aquele mês
 *   2) segundo toque: expande end (se for depois) ou redefine start (se for antes)
 *   3) novo primeiro toque: reseta tudo no mês tocado
 */
export function PeriodPickerSheet({ visible, initialStart, initialEnd, onClose, onApply, monthsBack = 18 }: Props) {
  const { colors, radius } = useTheme();
  const [start, setStart] = useState(startOfMonth(initialStart));
  const [end, setEnd] = useState(startOfMonth(initialEnd));
  const [step, setStep] = useState<'first' | 'second'>('first');

  // reseta quando reabre
  useEffect(() => {
    if (visible) {
      setStart(startOfMonth(initialStart));
      setEnd(startOfMonth(initialEnd));
      setStep('first');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const months = useMemo(() => {
    const today = startOfMonth(new Date());
    return Array.from({ length: monthsBack }, (_, i) => addMonths(today, -i));
  }, [monthsBack]);

  function handleTap(month: Date) {
    const m = startOfMonth(month);
    if (step === 'first') {
      setStart(m);
      setEnd(m);
      setStep('second');
      return;
    }
    if (m.getTime() === start.getTime()) {
      setEnd(m);
      return;
    }
    if (m > start) {
      setEnd(m);
    } else {
      setEnd(start);
      setStart(m);
    }
    setStep('first');
  }

  function isInRange(month: Date) {
    const m = startOfMonth(month).getTime();
    return m >= start.getTime() && m <= end.getTime();
  }

  function quick(label: string, monthsAgo: number) {
    const e = startOfMonth(new Date());
    const s = addMonths(e, -monthsAgo);
    return (
      <Pressable
        onPress={() => {
          setStart(s);
          setEnd(e);
          setStep('first');
        }}
        style={[styles.quickPill, { borderColor: colors.brandDivider, backgroundColor: colors.brandSurfaceAlt }]}
        key={label}
      >
        <Text style={{ color: colors.brandTextSecondary, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      </Pressable>
    );
  }

  if (!visible) return null;

  const sameMonth = start.getTime() === end.getTime();
  const subtitle = sameMonth
    ? capitalize(format(start, "LLLL 'de' yyyy", { locale: ptBR }))
    : `${capitalize(format(start, "LLL 'de' yy", { locale: ptBR }))}  →  ${capitalize(format(end, "LLL 'de' yy", { locale: ptBR }))}`;

  return (
    <BottomSheet onClose={onClose} maxHeightFraction={0.85} asNativeModal>
      <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Filtrar período</Text>
      <Text style={[styles.subtitle, { color: colors.brandPrimaryDark }]}>{subtitle}</Text>
      <Text style={[styles.hint, { color: colors.brandTextSecondary }]}>
        {step === 'first' ? 'Toque num mês pra começar' : 'Agora toque no mês final'}
      </Text>

      <View style={styles.quickRow}>
        {quick('Este mês', 0)}
        {quick('3 meses', 2)}
        {quick('6 meses', 5)}
        {quick('1 ano', 11)}
      </View>

      <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {months.map((m) => {
            const inRange = isInRange(m);
            const isStartEdge = isSameMonth(m, start);
            const isEndEdge = isSameMonth(m, end);
            const isEdge = isStartEdge || isEndEdge;
            const bg = isEdge ? colors.brandPrimaryDark : inRange ? colors.brandPrimaryTint : colors.brandSurfaceAlt;
            const fgColor = isEdge ? '#FFFFFF' : inRange ? colors.brandPrimaryDark : colors.brandTextSecondary;
            return (
              <Pressable
                key={m.toISOString()}
                onPress={() => handleTap(m)}
                style={[
                  styles.monthCell,
                  {
                    backgroundColor: bg,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Text style={{ color: fgColor, fontSize: 15, fontWeight: '800', textTransform: 'capitalize' }}>
                  {format(m, "LLL", { locale: ptBR })}
                </Text>
                <Text style={{ color: fgColor, fontSize: 11, fontWeight: '700', opacity: 0.85 }}>
                  {format(m, 'yyyy')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Button
        label="Aplicar"
        onPress={() => {
          onApply(start, endOfMonth(end));
          onClose();
        }}
        style={{ marginTop: 16 }}
      />
      <Button label="Cancelar" variant="secondary" onPress={onClose} style={{ marginTop: 8 }} />
    </BottomSheet>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  hint: { fontSize: 12, fontWeight: '500', marginBottom: 14 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  quickPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthCell: {
    width: '31%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
