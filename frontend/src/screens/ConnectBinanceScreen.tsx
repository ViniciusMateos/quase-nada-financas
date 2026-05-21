import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataRefresh } from '@/contexts/DataRefreshContext';
import { normalizeError } from '@/lib/errorMap';
import { binanceService } from '@/services/binance.service';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';

export default function ConnectBinanceScreen() {
  const navigation = useNavigation<any>();
  const { colors, radius, shadows } = useTheme();
  const bumpRefresh = useDataRefresh();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(true);

  async function doReplace() {
    setLoading(true);
    setError(null);
    try {
      await binanceService.replace(apiKey.trim(), apiSecret.trim());
      bumpRefresh();
      navigation.goBack();
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await binanceService.connect(apiKey.trim(), apiSecret.trim());
      bumpRefresh();
      navigation.goBack();
    } catch (err) {
      const normalized = normalizeError(err);
      // 409 = já existe conta conectada. Oferece substituir.
      if (normalized.statusCode === 409) {
        setLoading(false);
        Alert.alert(
          'Conta já conectada',
          'Já existe uma conta Binance vinculada. Substituir pelas novas chaves?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Substituir', onPress: doReplace },
          ]
        );
        return;
      }
      setError(normalized.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={styles.padded}>
      <ScreenHeader title="Conectar Binance" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.infoCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
          <Pressable onPress={() => setHelpOpen((v) => !v)} style={styles.infoHeader}>
            <Ionicons name="information-circle" size={20} color={colors.brandPrimaryDark} />
            <Text style={[styles.infoTitle, { color: colors.brandTextPrimary, flex: 1 }]}>
              Como conseguir suas chaves
            </Text>
            <Ionicons
              name={helpOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.brandTextSecondary}
            />
          </Pressable>

          {helpOpen ? (
            <View style={styles.steps}>
              <Step n={1} title="Abre o app da Binance" colors={colors}>
                Faz login. Se não tiver conta, baixa o app oficial da Binance na loja primeiro.
              </Step>

              <Step n={2} title="Toca em More (···)" colors={colors}>
                Na tela inicial do app, procura o ícone <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>More</Text> (três pontinhos) — geralmente fica na barra de baixo ou no menu rápido.
              </Step>

              <Step n={3} title="Rola até 'Others' e abre API Management" colors={colors}>
                Dentro de <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>More Services</Text>, vai descendo até a seção <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>Others</Text> lá no fim → toca em <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>API Management</Text>.
              </Step>

              <Step n={4} title="Cria a API key" colors={colors}>
                Toca <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>Create API</Text> → escolhe <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>System generated</Text> → dá um nome (ex: "Quase Nada Finanças") → confirma com 2FA.
              </Step>

              <Step n={5} title="Configura permissões" colors={colors}>
                Na API recém-criada, toca em <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>Edit restrictions</Text> e deixa:{'\n'}
                ✓ <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>Enable Reading</Text>{'\n'}
                ✓ <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>Enable Spot & Margin Trading</Text>{'\n'}
                ✗ <Text style={[styles.bold, { color: colors.brandTextNegative }]}>Enable Withdrawals — DEIXA DESLIGADO</Text>{'\n'}
                Salva (confirma com 2FA de novo).
              </Step>

              <View style={[styles.tip, { borderColor: colors.brandPrimaryDark, backgroundColor: colors.brandPrimaryTint }]}>
                <Ionicons name="bulb-outline" size={16} color={colors.brandPrimaryDark} />
                <Text style={[styles.tipText, { color: colors.brandTextSecondary }]}>
                  Se <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>Enable Spot</Text> aparece bloqueado e só "Symbol Whitelist" liberado: é trava antifraude da Binance pra contas que receberam P2P recente. Vai em <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>Security → Account Security → Anti-Phishing / P2P Account Lock</Text> e desativa as restrições. Depois volta aqui e libera Spot.
                </Text>
              </View>

              <Step n={6} title="Copia API Key e Secret Key" colors={colors}>
                Toca no olhinho 👁 pra revelar a <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>Secret Key</Text> — ela só aparece UMA vez. Copia ela e a API Key, cola nos campos aqui embaixo.
              </Step>

              <View style={[styles.altPath, { borderColor: colors.brandDivider }]}>
                <Ionicons name="globe-outline" size={14} color={colors.brandTextSecondary} />
                <Text style={[styles.altPathText, { color: colors.brandTextSecondary }]}>
                  Prefere pelo navegador?{' '}
                  <Link colors={colors} url="https://www.binance.com/en/my/settings/api-management">
                    Atalho web direto
                  </Link>
                </Text>
              </View>

              <View style={[styles.warning, { borderColor: colors.brandTextNegative }]}>
                <Ionicons name="shield-checkmark" size={16} color={colors.brandTextNegative} />
                <Text style={[styles.warningText, { color: colors.brandTextSecondary }]}>
                  Suas chaves ficam <Text style={[styles.bold, { color: colors.brandTextPrimary }]}>criptografadas</Text> no servidor. E com Withdrawals desligado, mesmo se vazar ninguém consegue tirar seu dinheiro — só ver e comprar.
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <TextField label="API Key" value={apiKey} onChangeText={setApiKey} autoCapitalize="none" />
        <TextField label="Secret Key" value={apiSecret} onChangeText={setApiSecret} secure />

        {error ? <Text style={[styles.error, { color: colors.brandTextError }]}>{error}</Text> : null}

        <Button label="Conectar" loading={loading} disabled={!apiKey || !apiSecret} onPress={submit} />
        <Button label="Cancelar" variant="secondary" onPress={() => navigation.goBack()} />
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Step({ n, title, colors, children }: { n: number; title: string; colors: any; children: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepNum, { backgroundColor: colors.brandPrimaryTint }]}>
        <Text style={[styles.stepNumText, { color: colors.brandPrimaryDark }]}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepTitle, { color: colors.brandTextPrimary }]}>{title}</Text>
        <Text style={[styles.stepBody, { color: colors.brandTextSecondary }]}>{children}</Text>
      </View>
    </View>
  );
}

function Link({ url, colors, children }: { url: string; colors: any; children: React.ReactNode }) {
  return (
    <Text style={{ color: colors.brandPrimaryDark, fontWeight: '700' }} onPress={() => Linking.openURL(url)}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16 },
  infoCard: { padding: 14 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoTitle: { fontSize: 14, fontWeight: '800' },
  steps: { marginTop: 12, gap: 14 },
  step: { flexDirection: 'row', gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 12, fontWeight: '900' },
  stepTitle: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  stepBody: { fontSize: 12, lineHeight: 18 },
  bold: { fontWeight: '800' },
  warning: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    alignItems: 'flex-start',
  },
  warningText: { fontSize: 11, lineHeight: 16, flex: 1 },
  altPath: {
    flexDirection: 'row',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  altPathText: { fontSize: 11, flex: 1 },
  tip: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    alignItems: 'flex-start',
  },
  tipText: { fontSize: 11, lineHeight: 16, flex: 1 },
  error: { fontWeight: '700' },
});
