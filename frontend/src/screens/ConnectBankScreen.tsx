import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { PluggyConnect } from 'react-native-pluggy-connect';
import { useNavigation } from '@react-navigation/native';
import { normalizeError } from '@/lib/errorMap';
import { pluggyService } from '@/services/pluggy.service';
import { ErrorState, LoadingOverlay } from '@/ui/States';

export default function ConnectBankScreen() {
  const navigation = useNavigation<any>();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await pluggyService.connectToken();
      setToken(res.connectToken);
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSuccess({ item }: { item: { id: string } }) {
    try {
      setConnecting(true);
      await pluggyService.callback(item.id);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erro', normalizeError(err).message);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1 }}>
        {loading && <LoadingOverlay message="Preparando conexão..." />}
        {error && <ErrorState subtitle={error} onRetry={load} />}
        {!loading && !error && token && (
          <PluggyConnect
            connectToken={token}
            includeSandbox={true}
            onSuccess={handleSuccess}
            onError={(err: any) => {
              Alert.alert('Erro', err?.message ?? 'Falha na conexão');
            }}
            onClose={() => navigation.goBack()}
          />
        )}
        {connecting && <LoadingOverlay message="Conectando conta..." />}
      </View>
    </View>
  );
}
