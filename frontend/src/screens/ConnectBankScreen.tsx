import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { normalizeError } from '@/lib/errorMap';
import { pluggyService } from '@/services/pluggy.service';
import { theme } from '@/theme/theme';
import { Button } from '@/ui/Button';
import { ErrorState, LoadingOverlay } from '@/ui/States';

export default function ConnectBankScreen() {
  const navigation = useNavigation<any>();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setToken((await pluggyService.connectToken()).connectToken); }
    catch (err) { setError(normalizeError(err).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleMessage(raw: string) {
    try {
      const data = JSON.parse(raw);
      if (data.event !== 'ITEM_CONNECTED' && data.type !== 'ITEM_CONNECTED') return;
      setConnecting(true);
      await pluggyService.callback(data.itemId);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erro', normalizeError(err).message);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Conectar Conta Bancaria</Text>
        <Button label="Fechar" variant="secondary" onPress={() => navigation.goBack()} style={{ width: 100 }} />
      </View>
      {loading ? <LoadingOverlay message="Preparando conexao..." /> : null}
      {error ? <ErrorState subtitle={error} onRetry={load} /> : null}
      {token ? (
        <WebView
          source={{ uri: `https://connect.pluggy.ai?connectToken=${encodeURIComponent(token)}` }}
          onMessage={(event) => handleMessage(event.nativeEvent.data)}
          startInLoadingState
        />
      ) : null}
      {connecting ? <LoadingOverlay message="Conectando conta..." /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.brandSurface },
  header: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '800', color: theme.colors.brandTextPrimary }
});
