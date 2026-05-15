import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { normalizeError } from '@/lib/errorMap';
import { binanceService } from '@/services/binance.service';
import { theme } from '@/theme/theme';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

export default function ConnectBinanceScreen() {
  const navigation = useNavigation<any>();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true); setError(null);
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
    <View style={styles.container}>
      <Text style={styles.title}>Conectar Binance</Text>
      <TextField label="API Key" value={apiKey} onChangeText={setApiKey} autoCapitalize="none" />
      <TextField label="API Secret" value={apiSecret} onChangeText={setApiSecret} secure />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Conectar" loading={loading} disabled={!apiKey || !apiSecret} onPress={submit} />
      <Button label="Cancelar" variant="secondary" onPress={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16, backgroundColor: theme.colors.brandBackground },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.brandTextPrimary },
  error: { color: theme.colors.brandTextError, fontWeight: '700' }
});
