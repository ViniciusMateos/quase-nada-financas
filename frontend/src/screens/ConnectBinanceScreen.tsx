import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { normalizeError } from '@/lib/errorMap';
import { binanceService } from '@/services/binance.service';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';

export default function ConnectBinanceScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await binanceService.connect(apiKey.trim(), apiSecret.trim());
      navigation.goBack();
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={styles.padded}>
      <ScreenHeader title="Conectar Binance" />
      <TextField label="API Key" value={apiKey} onChangeText={setApiKey} autoCapitalize="none" />
      <TextField label="API Secret" value={apiSecret} onChangeText={setApiSecret} secure />
      {error ? <Text style={[styles.error, { color: colors.brandTextError }]}>{error}</Text> : null}
      <Button label="Conectar" loading={loading} disabled={!apiKey || !apiSecret} onPress={submit} />
      <Button label="Cancelar" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16, gap: 16 },
  error: { fontWeight: '700' },
});
