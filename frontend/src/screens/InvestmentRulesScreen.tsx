import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useInvestmentRules } from '@/hooks/useInvestmentRules';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/ui/Button';
import { EmptyState, ErrorState, ListSkeleton } from '@/ui/States';
import { dogRefreshControl, DogRefreshHeader } from '@/ui/DogRefresh';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import type { InvestmentRule } from '@/types/api.types';

const TRIGGER_LABEL: Record<string, (r: InvestmentRule) => string> = {
  monthly: (r) => `Todo dia ${r.triggerDay} do mês`,
  weekly: (r) => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return `Toda ${days[r.triggerDay ?? 0]?.toLowerCase()}`;
  },
  salary_received: (r) =>
    `Quando entrar salário ≥ ${formatCurrency(r.triggerMinAmount ?? 0)}`,
};

const ACTION_LABEL: Record<string, (r: InvestmentRule) => string> = {
  buy_binance: (r) => `comprar ${formatCurrency(r.amountBrl)} em ${r.asset}`,
  reminder: (r) => `lembrar ${formatCurrency(r.amountBrl)} em ${r.asset}`,
};

export default function InvestmentRulesScreen() {
  const navigation = useNavigation<any>();
  const { colors, radius, shadows } = useTheme();
  const { rules, loading, refreshing, error, busyId, reload, toggleActive, remove } = useInvestmentRules();

  if (error) {
    return (
      <Screen style={styles.padded}>
        <ScreenHeader title="Regras de investimento" />
        <ErrorState subtitle={error} onRetry={reload} />
      </Screen>
    );
  }

  const handleDelete = (rule: InvestmentRule) => {
    Alert.alert('Apagar regra?', `"${rule.name}" será removida.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => remove(rule.id) },
    ]);
  };

  return (
    <Screen style={styles.padded}>
      <ScreenHeader
        title="Regras de investimento"
        rightAction={{ icon: 'add', onPress: () => navigation.navigate('EditInvestmentRule') }}
      />

      <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={dogRefreshControl(refreshing, reload)}
      >
        <DogRefreshHeader refreshing={loading || refreshing} />
        {loading && rules.length === 0 ? (
          <ListSkeleton />
        ) : rules.length === 0 ? (
          <EmptyState
            title="Sem regras criadas"
            subtitle="Crie sua primeira regra de investimento automatizado."
            actionLabel="Criar regra"
            onAction={() => navigation.navigate('EditInvestmentRule')}
          />
        ) : (
          rules.map((rule) => {
            const triggerText = TRIGGER_LABEL[rule.triggerType]?.(rule) ?? rule.triggerType;
            const actionText = ACTION_LABEL[rule.actionType]?.(rule) ?? rule.actionType;
            const fired = rule.firesThisMonth;
            return (
              <Pressable
                key={rule.id}
                onPress={() => navigation.navigate('EditInvestmentRule', { ruleId: rule.id })}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.name, { color: colors.brandTextPrimary }]} numberOfLines={1}>
                    {rule.name}
                  </Text>
                  <Switch
                    value={rule.active}
                    onValueChange={() => toggleActive(rule)}
                    disabled={busyId === rule.id}
                    trackColor={{ false: colors.brandDivider, true: colors.brandPrimaryDark }}
                  />
                </View>

                <Text style={[styles.line, { color: colors.brandTextSecondary }]} numberOfLines={2}>
                  {triggerText} → {actionText}
                </Text>

                <View style={styles.footer}>
                  <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>
                    {fired}/{rule.maxFiresPerMonth} disparos no mês
                  </Text>
                  {rule.lastError ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="warning" size={12} color={colors.brandTextNegative} />
                      <Text style={[styles.metaError, { color: colors.brandTextNegative }]} numberOfLines={1}>
                        {rule.lastError}
                      </Text>
                    </View>
                  ) : null}
                  <Pressable onPress={() => handleDelete(rule)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.brandError} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}

        {rules.length > 0 ? (
          <Button
            label="Nova regra"
            icon="add"
            onPress={() => navigation.navigate('EditInvestmentRule')}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16 },
  card: { padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '800', flex: 1, marginRight: 12 },
  line: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  meta: { fontSize: 11, fontWeight: '600' },
  metaError: { fontSize: 11, maxWidth: 160 },
});
