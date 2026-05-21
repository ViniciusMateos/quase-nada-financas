import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useInvestmentRules } from '@/hooks/useInvestmentRules';
import { normalizeError } from '@/lib/errorMap';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import type { InvestmentRule } from '@/types/api.types';

type TriggerType = 'monthly' | 'weekly' | 'salary_received';
type ActionType = 'buy_binance' | 'reminder';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function EditInvestmentRuleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, radius } = useTheme();
  const { rules, create, update } = useInvestmentRules();
  const editing = useMemo<InvestmentRule | null>(
    () => rules.find((r) => r.id === route.params?.ruleId) ?? null,
    [rules, route.params?.ruleId]
  );

  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('monthly');
  const [triggerDay, setTriggerDay] = useState('5');
  const [triggerMinAmount, setTriggerMinAmount] = useState('3000');
  const [actionType, setActionType] = useState<ActionType>('buy_binance');
  const [asset, setAsset] = useState('BTC');
  const [amountBrl, setAmountBrl] = useState('100');
  const [maxFiresPerMonth, setMaxFiresPerMonth] = useState('2');
  const [maxAmountBrl, setMaxAmountBrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setTriggerType(editing.triggerType);
      setTriggerDay(String(editing.triggerDay ?? ''));
      setTriggerMinAmount(String(editing.triggerMinAmount ?? ''));
      setActionType(editing.actionType);
      setAsset(editing.asset);
      setAmountBrl(String(editing.amountBrl));
      setMaxFiresPerMonth(String(editing.maxFiresPerMonth));
      setMaxAmountBrl(editing.maxAmountBrl != null ? String(editing.maxAmountBrl) : '');
    }
  }, [editing]);

  async function save() {
    const amount = parseFloat(amountBrl.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Inválido', 'Valor a investir precisa ser positivo.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Inválido', 'Dê um nome pra regra.');
      return;
    }

    const body: any = {
      name: name.trim(),
      triggerType,
      actionType,
      asset: asset.trim().toUpperCase(),
      amountBrl: amount,
      maxFiresPerMonth: parseInt(maxFiresPerMonth, 10) || 2,
    };

    if (maxAmountBrl.trim()) {
      const m = parseFloat(maxAmountBrl.replace(',', '.'));
      if (Number.isFinite(m) && m > 0) body.maxAmountBrl = m;
    }

    if (triggerType === 'monthly') {
      const d = parseInt(triggerDay, 10);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        Alert.alert('Inválido', 'Dia do mês precisa ser 1-31.');
        return;
      }
      body.triggerDay = d;
    } else if (triggerType === 'weekly') {
      const d = parseInt(triggerDay, 10);
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        Alert.alert('Inválido', 'Dia da semana precisa ser 0 (dom) a 6 (sáb).');
        return;
      }
      body.triggerDay = d;
    } else {
      const m = parseFloat(triggerMinAmount.replace(',', '.'));
      if (!Number.isFinite(m) || m <= 0) {
        Alert.alert('Inválido', 'Valor mínimo do salário precisa ser positivo.');
        return;
      }
      body.triggerMinAmount = m;
    }

    setSaving(true);
    try {
      if (editing) await update(editing.id, body);
      else await create(body);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erro', normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen style={styles.padded}>
      <ScreenHeader title={editing ? 'Editar regra' : 'Nova regra'} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Label colors={colors}>Nome</Label>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="DCA mensal BTC"
          placeholderTextColor={colors.brandTextSecondary}
          style={[styles.input, { backgroundColor: colors.brandSurfaceAlt, color: colors.brandTextPrimary, borderColor: colors.brandDivider, borderRadius: radius.md }]}
          maxLength={120}
        />

        <Label colors={colors}>Quando disparar</Label>
        <View style={styles.row}>
          <Pill label="Todo mês" active={triggerType === 'monthly'} onPress={() => setTriggerType('monthly')} />
          <Pill label="Toda semana" active={triggerType === 'weekly'} onPress={() => setTriggerType('weekly')} />
          <Pill label="Salário caiu" active={triggerType === 'salary_received'} onPress={() => setTriggerType('salary_received')} />
        </View>

        {triggerType === 'monthly' ? (
          <>
            <Label colors={colors}>Dia do mês (1-31)</Label>
            <TextInput
              value={triggerDay}
              onChangeText={setTriggerDay}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.input, { backgroundColor: colors.brandSurfaceAlt, color: colors.brandTextPrimary, borderColor: colors.brandDivider, borderRadius: radius.md }]}
            />
          </>
        ) : triggerType === 'weekly' ? (
          <>
            <Label colors={colors}>Dia da semana</Label>
            <View style={styles.row}>
              {WEEKDAYS.map((d, i) => (
                <Pill key={d} label={d} small active={triggerDay === String(i)} onPress={() => setTriggerDay(String(i))} />
              ))}
            </View>
          </>
        ) : (
          <>
            <Label colors={colors}>Valor mínimo do salário (R$)</Label>
            <TextInput
              value={triggerMinAmount}
              onChangeText={setTriggerMinAmount}
              keyboardType="decimal-pad"
              style={[styles.input, { backgroundColor: colors.brandSurfaceAlt, color: colors.brandTextPrimary, borderColor: colors.brandDivider, borderRadius: radius.md }]}
            />
          </>
        )}

        <Label colors={colors}>Ação</Label>
        <View style={styles.row}>
          <Pill label="Comprar na Binance" active={actionType === 'buy_binance'} onPress={() => setActionType('buy_binance')} />
          <Pill label="Lembrete" active={actionType === 'reminder'} onPress={() => setActionType('reminder')} />
        </View>

        <Label colors={colors}>Ativo</Label>
        <TextInput
          value={asset}
          onChangeText={setAsset}
          placeholder={actionType === 'buy_binance' ? 'BTC, ETH...' : 'LCI Rico, PETR4...'}
          placeholderTextColor={colors.brandTextSecondary}
          autoCapitalize="characters"
          maxLength={32}
          style={[styles.input, { backgroundColor: colors.brandSurfaceAlt, color: colors.brandTextPrimary, borderColor: colors.brandDivider, borderRadius: radius.md }]}
        />

        <Label colors={colors}>Valor por aporte (R$)</Label>
        <TextInput
          value={amountBrl}
          onChangeText={setAmountBrl}
          keyboardType="decimal-pad"
          style={[styles.input, { backgroundColor: colors.brandSurfaceAlt, color: colors.brandTextPrimary, borderColor: colors.brandDivider, borderRadius: radius.md }]}
        />

        <Label colors={colors}>Limites de segurança</Label>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.hint, { color: colors.brandTextSecondary }]}>Máx disparos/mês</Text>
            <TextInput
              value={maxFiresPerMonth}
              onChangeText={setMaxFiresPerMonth}
              keyboardType="number-pad"
              style={[styles.input, { backgroundColor: colors.brandSurfaceAlt, color: colors.brandTextPrimary, borderColor: colors.brandDivider, borderRadius: radius.md, marginTop: 4 }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.hint, { color: colors.brandTextSecondary }]}>Hard cap por execução</Text>
            <TextInput
              value={maxAmountBrl}
              onChangeText={setMaxAmountBrl}
              keyboardType="decimal-pad"
              placeholder="auto"
              placeholderTextColor={colors.brandTextSecondary}
              style={[styles.input, { backgroundColor: colors.brandSurfaceAlt, color: colors.brandTextPrimary, borderColor: colors.brandDivider, borderRadius: radius.md, marginTop: 4 }]}
            />
          </View>
        </View>

        <Button label={editing ? 'Salvar' : 'Criar regra'} onPress={save} loading={saving} disabled={saving} style={{ marginTop: 20 }} />
        <Button label="Cancelar" variant="secondary" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} disabled={saving} />
      </ScrollView>
    </Screen>
  );
}

function Label({ children, colors }: { children: string; colors: any }) {
  return (
    <Text style={[styles.label, { color: colors.brandTextSecondary }]}>{children}</Text>
  );
}

function Pill({ label, active, onPress, small }: { label: string; active: boolean; onPress: () => void; small?: boolean }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        small && styles.pillSmall,
        {
          backgroundColor: active ? colors.brandPrimaryTint : colors.brandSurfaceAlt,
          borderColor: active ? colors.brandPrimary : 'transparent',
          borderRadius: radius.md,
        },
      ]}
    >
      <Text style={[styles.pillText, small && styles.pillTextSmall, { color: active ? colors.brandPrimaryDark : colors.brandTextSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16 },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 6 },
  hint: { fontSize: 11, fontWeight: '600' },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5 },
  pillSmall: { paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },
  pillTextSmall: { fontSize: 11 },
});
