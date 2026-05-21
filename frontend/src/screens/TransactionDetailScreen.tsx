import React, { useCallback, useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, Platform, ScrollView, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatters';
import { transactionsService } from '@/services/transactions.service';
import { TRANSACTION_UPDATED_EVENT, TransactionUpdatedPayload } from '@/screens/EditTransactionSheet';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { LoadingDog } from '@/ui/LoadingDog';
import { dogRefreshControl, DogRefreshOverlay } from '@/ui/DogRefresh';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import type { Transaction } from '@/types/api.types';

function notify(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert('Tudo certo', msg);
}

export default function TransactionDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, radius, shadows } = useTheme();
  const [tx, setTx] = useState<Transaction>(route.params.transaction as Transaction);
  const positive = tx.amount > 0;

  const [similar, setSimilar] = useState<Transaction[]>([]);
  const [similarLoading, setSimilarLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const reloadSimilar = useCallback(() => {
    let alive = true;
    setSimilarLoading(true);
    transactionsService
      .similar(tx.id)
      .then((res) => {
        if (alive) setSimilar(res.items ?? []);
      })
      .catch(() => undefined)
      .finally(() => alive && setSimilarLoading(false));
    return () => {
      alive = false;
    };
  }, [tx.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        transactionsService.similar(tx.id).then((res) => setSimilar(res.items ?? [])).catch(() => undefined),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [tx.id]);

  useEffect(() => {
    const cleanup = reloadSimilar();
    return cleanup;
  }, [reloadSimilar]);

  // Escuta o evento global emitido pelo EditTransactionSheet ao salvar.
  // Funcao em route.params dispara warning de non-serializable, por isso
  // usamos DeviceEventEmitter.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      TRANSACTION_UPDATED_EVENT,
      ({ updated, affected }: TransactionUpdatedPayload) => {
        if (updated.id !== tx.id) return;
        setTx(updated);
        reloadSimilar();
        if (affected > 0) {
          notify(`Aplicado em mais ${affected} transação${affected === 1 ? '' : 'ões'} similar.`);
        } else {
          notify('Transação atualizada.');
        }
      }
    );
    return () => sub.remove();
  }, [tx.id, reloadSimilar]);

  const openEditor = useCallback(() => {
    navigation.navigate('EditTransaction', { transaction: tx });
  }, [navigation, tx]);

  return (
    <Screen style={styles.padded}>
      <ScreenHeader
        title="Detalhe da transação"
        rightAction={{ icon: 'create-outline', onPress: openEditor }}
      />

      <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={dogRefreshControl(refreshing, onRefresh)}
      >
        <View style={[styles.heroCard, { backgroundColor: colors.brandSurface, borderRadius: radius.xl, ...shadows.card }]}>
          <CategoryIcon icon={tx.categoryIcon} color={tx.categoryColor || colors.brandPrimary} size={28} />
          <View style={{ height: 12 }} />
          <Text style={[styles.value, { color: positive ? colors.brandTextPositive : colors.brandTextNegative }]}>
            {positive ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
          </Text>
          <Text style={[styles.title, { color: colors.brandTextPrimary }]} numberOfLines={2}>{tx.description}</Text>
          <Text style={[styles.subtitle, { color: colors.brandTextSecondary }]}>{formatDateTime(tx.occurredAt)}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
          <Detail label="Conta" value={tx.accountName || 'Conta'} colors={colors} />
          <Divider colors={colors} />
          <Detail
            label="Categoria"
            value={tx.categoryName || 'Sem categoria'}
            colors={colors}
            iconNode={<CategoryIcon icon={tx.categoryIcon} color={tx.categoryColor || colors.brandPrimary} size={14} padded={false} />}
          />
          <Divider colors={colors} />
          <Detail
            label="Assinatura"
            value={
              tx.isSubscriptionOverride === true
                ? 'Sim (forçado)'
                : tx.isSubscriptionOverride === false
                ? 'Não (forçado)'
                : 'Automático'
            }
            colors={colors}
          />
          <Divider colors={colors} />
          <Detail label="Status" value={tx.pending ? 'Pendente' : 'Confirmada'} colors={colors} />
        </View>

        <Text style={[styles.section, { color: colors.brandTextSecondary }]}>Já apareceu antes</Text>
        <View style={[styles.groupCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
          {similarLoading ? (
            <View style={{ paddingVertical: 18, alignItems: 'center' }}>
              <LoadingDog size={28} color={colors.brandPrimaryDark} />
            </View>
          ) : similar.length === 0 ? (
            <Text style={[styles.empty, { color: colors.brandTextSecondary }]}>Sem registros parecidos.</Text>
          ) : (
            similar.map((s, i) => (
              <View
                key={s.id}
                style={[
                  styles.similarRow,
                  i < similar.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.brandDivider },
                ]}
              >
                <View style={styles.similarLeft}>
                  <Text style={[styles.similarDesc, { color: colors.brandTextPrimary }]} numberOfLines={1}>
                    {s.description}
                  </Text>
                  <Text style={[styles.similarMeta, { color: colors.brandTextSecondary }]}>{formatDate(s.occurredAt)}</Text>
                </View>
                <Text
                  style={[
                    styles.similarAmount,
                    { color: s.amount >= 0 ? colors.brandTextPositive : colors.brandTextNegative },
                  ]}
                >
                  {s.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(s.amount))}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <DogRefreshOverlay refreshing={refreshing} />
      </View>
    </Screen>
  );
}

function Detail({ label, value, colors, iconNode }: { label: string; value: string; colors: any; iconNode?: React.ReactNode }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.brandTextSecondary }]}>{label}</Text>
      <View style={styles.detailValueWrap}>
        {iconNode}
        <Text style={[styles.detailValue, { color: colors.brandTextPrimary }]}>{value}</Text>
      </View>
    </View>
  );
}

function Divider({ colors }: { colors: any }) {
  return <View style={[styles.divider, { backgroundColor: colors.brandDivider }]} />;
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16 },
  heroCard: { padding: 22, alignItems: 'center', marginTop: 8 },
  heroIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroIconText: { fontSize: 26 },
  value: { fontSize: 30, fontWeight: '900' },
  title: { marginTop: 10, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 6, fontSize: 13 },
  card: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 6 },
  detailRow: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailIcon: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth },
  section: { marginTop: 24, marginBottom: 10, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, paddingLeft: 4 },
  groupCard: { paddingVertical: 4 },
  empty: { padding: 18, textAlign: 'center', fontSize: 13 },
  similarRow: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  similarLeft: { flex: 1, marginRight: 12 },
  similarDesc: { fontSize: 14, fontWeight: '700' },
  similarMeta: { fontSize: 12, marginTop: 2 },
  similarAmount: { fontWeight: '800', fontSize: 14 },
});
