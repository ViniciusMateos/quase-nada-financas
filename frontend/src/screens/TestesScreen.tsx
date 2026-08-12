import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { TabScreen } from '@/ui/TabScreen';

type TestNoti = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

// Réplicas locais das notificações reais que o backend (worker) dispara. Servem
// pra ver o visual/copy sem esperar o dia certo. Os valores são de exemplo.
const NOTIFICACOES: TestNoti[] = [
  {
    key: 'fatura_fechou',
    icon: 'document-text-outline',
    label: 'Fatura fechou',
    title: 'Fatura fechou',
    body: 'A fatura do Mercado Pago fechou em aproximadamente R$ 3.040,33. Vence 15/08.',
    data: { type: 'credit_card_closed' },
  },
  {
    key: 'vence_amanha',
    icon: 'alarm-outline',
    label: 'Vence amanhã',
    title: 'Fatura vence amanhã',
    body: 'A fatura do Nubank (R$ 398,56) vence amanhã, 17/08. Não esquece!',
    data: { type: 'credit_card_due_tomorrow' },
  },
  {
    key: 'vence_hoje',
    icon: 'notifications-outline',
    label: 'Vence hoje',
    title: 'Fatura vence hoje',
    body: 'Hoje é o vencimento da fatura do Mercado Pago: R$ 3.040,33.',
    data: { type: 'credit_card_due_today' },
  },
  {
    key: 'resumo_semanal',
    icon: 'stats-chart-outline',
    label: 'Resumo semanal',
    title: 'Resumo da semana',
    body: 'Entrou R$ 6.500,00, saiu R$ 2.348,73. Saldo +R$ 4.151,27. Toque pra ver os detalhes.',
    data: { type: 'weekly_summary' },
  },
];

export default function TestesScreen() {
  const { colors, radius, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [ultimo, setUltimo] = useState<string | null>(null);

  async function garantirPermissao(): Promise<boolean> {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync();
    if (req.status === 'granted') return true;
    Alert.alert('Permissão desligada', 'Ative as notificações do Quase Nada Finanças nos Ajustes do iPhone.');
    return false;
  }

  async function disparar(n: TestNoti) {
    if (!(await garantirPermissao())) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, data: n.data, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, repeats: false },
    });
    setUltimo(n.key);
  }

  async function dispararTodas() {
    if (!(await garantirPermissao())) return;
    for (let i = 0; i < NOTIFICACOES.length; i++) {
      const n = NOTIFICACOES[i];
      await Notifications.scheduleNotificationAsync({
        content: { title: n.title, body: n.body, data: n.data, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 + i * 2, repeats: false },
      });
    }
    setUltimo('todas');
  }

  return (
    <TabScreen>
      <Text style={styles.title}>Testes</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.section}>Notificações</Text>
        <View style={[styles.hintCard, { ...shadows.card }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.brandTextSecondary} />
          <Text style={styles.hint}>
            Dispara uma versão local (aparece em ~2s). É só o visual — os valores são de exemplo. As de
            verdade o servidor manda no dia certo.
          </Text>
        </View>

        <View style={[styles.card, { ...shadows.card }]}>
          {NOTIFICACOES.map((n, i) => (
            <Pressable
              key={n.key}
              onPress={() => disparar(n)}
              style={({ pressed }) => [
                styles.row,
                i < NOTIFICACOES.length - 1 && styles.rowDivider,
                pressed && { opacity: 0.6 },
              ]}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.brandPrimaryTint }]}>
                <Ionicons name={n.icon} size={18} color={colors.brandPrimaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{n.label}</Text>
                <Text style={styles.rowBody} numberOfLines={2}>{n.body}</Text>
              </View>
              {ultimo === n.key ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.brandPrimary} />
              ) : (
                <Ionicons name="play-circle-outline" size={22} color={colors.brandTextSecondary} />
              )}
            </Pressable>
          ))}
        </View>

        <Pressable onPress={dispararTodas} style={[styles.allBtn, { borderRadius: radius.md }]}>
          <Ionicons name="albums-outline" size={18} color={colors.brandTextOnPrimary} />
          <Text style={styles.allBtnText}>Disparar todas em sequência</Text>
        </Pressable>
      </ScrollView>
    </TabScreen>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    title: { fontSize: 24, fontWeight: '800', color: c.brandTextPrimary, marginBottom: 12 },
    section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: c.brandTextSecondary, marginBottom: 8, paddingLeft: 4 },
    hintCard: { flexDirection: 'row', gap: 8, backgroundColor: c.brandSurface, borderRadius: 14, padding: 12, marginBottom: 12, alignItems: 'flex-start' },
    hint: { flex: 1, fontSize: 12, lineHeight: 17, color: c.brandTextSecondary },
    card: { backgroundColor: c.brandSurface, borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.brandDivider },
    rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { fontSize: 15, fontWeight: '700', color: c.brandTextPrimary },
    rowBody: { fontSize: 12, color: c.brandTextSecondary, marginTop: 2 },
    allBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.brandPrimary, paddingVertical: 14 },
    allBtnText: { color: c.brandTextOnPrimary, fontSize: 15, fontWeight: '800' },
  });
}
