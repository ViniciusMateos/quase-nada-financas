import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { PluggyConnect } from 'react-native-pluggy-connect';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataRefresh } from '@/contexts/DataRefreshContext';
import { normalizeError } from '@/lib/errorMap';
import { pluggyService } from '@/services/pluggy.service';
import { ErrorState, LoadingOverlay } from '@/ui/States';

const SCHEME = (Constants.expoConfig?.scheme as string | undefined) ?? 'qnf';
const OAUTH_REDIRECT_URI = `${SCHEME}://pluggy-callback`;

function extractItemId(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('itemId') ?? parsed.searchParams.get('item_id');
  } catch {
    const match = url.match(/[?&]item(?:I|_i)d=([^&]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

export default function ConnectBankScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const bumpRefresh = useDataRefresh();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<{ title?: string; subtitle: string } | null>(null);
  const handledItemRef = useRef<string | null>(null);

  const finishWithItem = useCallback(async (itemId: string) => {
    if (handledItemRef.current === itemId) return;
    handledItemRef.current = itemId;
    try {
      setConnecting(true);
      await pluggyService.callback(itemId);
      bumpRefresh();
      navigation.goBack();
    } catch (err) {
      setError({ title: 'Falha ao concluir', subtitle: normalizeError(err).message });
    } finally {
      setConnecting(false);
    }
  }, [navigation, bumpRefresh]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setToken(null);
    handledItemRef.current = null;
    try {
      const res = await pluggyService.connectToken(OAUTH_REDIRECT_URI);
      setToken(res.connectToken);
    } catch (err) {
      setError({ title: 'Conexão bancária indisponível', subtitle: normalizeError(err).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onUrl({ url }: { url: string }) {
      if (!url.startsWith(`${SCHEME}://pluggy-callback`)) return;
      const itemId = extractItemId(url);
      if (itemId) finishWithItem(itemId);
    }
    const sub = Linking.addEventListener('url', onUrl);
    Linking.getInitialURL().then((url) => { if (url) onUrl({ url }); });
    return () => sub.remove();
  }, [finishWithItem]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.brandBackground }}>
      {loading ? (
        <LoadingOverlay message="Preparando conexão..." />
      ) : error ? (
        <ErrorState title={error.title} subtitle={error.subtitle} onRetry={load} />
      ) : token ? (
        <PluggyConnect
          connectToken={token}
          includeSandbox={true}
          allowConnectInBackground={true}
          onSuccess={({ item }) => finishWithItem(item.id)}
          onEvent={(payload: any) => {
            const item = payload?.item ?? payload?.metadata?.item;
            const status = item?.status ?? item?.executionStatus;
            const eventName = payload?.event ?? payload;
            if (item?.id && (eventName === 'LOGIN_STEP_COMPLETED' || status === 'UPDATED' || status === 'PARTIAL_SUCCESS' || status === 'SUCCESS')) {
              finishWithItem(item.id);
            }
          }}
          onError={(err: any) => {
            const item = err?.data?.item;
            if (item?.id) {
              finishWithItem(item.id);
              return;
            }
            setError({ title: 'Não foi possível conectar', subtitle: err?.message ?? 'Tente novamente em instantes.' });
          }}
          onClose={() => navigation.goBack()}
        />
      ) : null}
      {connecting && <LoadingOverlay message="Conectando conta..." />}
    </View>
  );
}
