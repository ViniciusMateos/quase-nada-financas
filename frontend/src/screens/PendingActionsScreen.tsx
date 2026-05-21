import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useInvestmentRules } from '@/hooks/useInvestmentRules';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { normalizeError } from '@/lib/errorMap';
import { Button } from '@/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { dogRefreshControl, DogRefreshOverlay } from '@/ui/DogRefresh';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import type { InvestmentPendingAction } from '@/types/api.types';

export default function PendingActionsScreen() {
  const { colors, radius, shadows } = useTheme();
  const { pending, loading, refreshing, error, busyId, reload, approve, dismiss } = useInvestmentRules();

  if (loading) {
    return (
      <Screen style={styles.padded}>
        <ScreenHeader title="Tarefas pendentes" />
        <LoadingState />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen style={styles.padded}>
        <ScreenHeader title="Tarefas pendentes" />
        <ErrorState subtitle={error} onRetry={reload} />
      </Screen>
    );
  }

  const handleApprove = (p: InvestmentPendingAction) => {
    const isBuy = p.actionType === 'buy_binance';
    Alert.alert(
      isBuy ? 'Confirmar compra?' : 'Marcar como feito?',
      isBuy
        ? `Vou comprar ${formatCurrency(p.amountBrl)} em ${p.asset} via Binance agora.`
        : `Confirmar que você investiu ${formatCurrency(p.amountBrl)} em ${p.asset}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: isBuy ? 'Comprar agora' : 'Já fiz',
          onPress: async () => {
            try {
              await approve(p.id);
            } catch (err) {
              Alert.alert('Erro', normalizeError(err).message);
            }
          },
        },
      ]
    );
  };

  const handleDismiss = (p: InvestmentPendingAction) => {
    Alert.alert('Descartar?', 'A pendência será marcada como descartada.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => dismiss(p.id).catch(() => undefined) },
    ]);
  };

  return (
    <Screen style={styles.padded}>
      <ScreenHeader title="Tarefas pendentes" />

      <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={dogRefreshControl(refreshing, reload)}
      >
        {pending.length === 0 ? (
          <EmptyState
            title="Tudo em dia"
            subtitle="Nenhuma tarefa pendente no momento."
          />
        ) : (
          pending.map((p) => {
            const isBuy = p.actionType === 'buy_binance';
            const isApproved = p.status === 'APPROVED';
            return (
              <View
                key={p.id}
                style={[styles.card, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: isBuy ? colors.brandPrimaryTint : 'rgba(245, 158, 11, 0.15)' }]}>
                    <Ionicons
                      name={isBuy ? 'cash-outline' : 'alarm-outline'}
                      size={20}
                      color={isBuy ? colors.brandPrimaryDark : colors.brandWarning ?? '#F59E0B'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: colors.brandTextPrimary }]} numberOfLines={1}>
                      {isBuy ? `Comprar ${p.asset}` : `Investir em ${p.asset}`}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.brandTextSecondary }]}>
                      {formatCurrency(p.amountBrl)}
                    </Text>
                  </View>
                  <Text style={[styles.due, { color: colors.brandTextSecondary }]}>
                    expira {formatDateTime(p.dueAt)}
                  </Text>
                </View>

                {isApproved ? (
                  <Text style={[styles.processing, { color: colors.brandTextSecondary }]}>Processando…</Text>
                ) : (
                  <View style={styles.actionsRow}>
                    <Button
                      label="Descartar"
                      variant="secondary"
                      onPress={() => handleDismiss(p)}
                      disabled={busyId === p.id}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label={isBuy ? 'Aprovar compra' : 'Já fiz'}
                      onPress={() => handleApprove(p)}
                      loading={busyId === p.id}
                      disabled={busyId === p.id}
                      style={{ flex: 1.4 }}
                    />
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
      <DogRefreshOverlay refreshing={refreshing} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16 },
  card: { padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800' },
  subtitle: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  due: { fontSize: 10, maxWidth: 90, textAlign: 'right' },
  actionsRow: { flexDirection: 'row', gap: 8 },
  processing: { fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
});
