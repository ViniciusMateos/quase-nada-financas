import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LoadingDog } from '@/ui/LoadingDog';

// Tempo mínimo em background pra re-bloquear (evita pedir Face ID em troca rápida de app)
const RELOCK_AFTER_MS = 15_000;

export function AppLockGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [unlocked, setUnlocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  const authenticate = useCallback(async () => {
    setAuthenticating(true);
    setError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // Sem biometria configurada no device → não bloqueia (não dá pra exigir
      // o que o aparelho não tem). Mas avisa.
      if (!hasHardware || !isEnrolled) {
        setUnlocked(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquear Quase Nada Finanças',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar código',
      });

      if (result.success) {
        setUnlocked(true);
      } else {
        setError('Autenticação cancelada. Toque pra tentar de novo.');
      }
    } catch {
      setError('Falha ao autenticar. Toque pra tentar de novo.');
    } finally {
      setAuthenticating(false);
    }
  }, []);

  // Autentica ao montar (quando há sessão)
  useEffect(() => {
    if (user && !unlocked) {
      authenticate();
    }
    if (!user) {
      // Sem sessão: libera (a tela de login cuida do acesso)
      setUnlocked(true);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-bloqueia ao voltar do background (após RELOCK_AFTER_MS)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active') {
        const awayFor = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        if (user && awayFor >= RELOCK_AFTER_MS) {
          setUnlocked(false);
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [user]);

  // Quando re-bloquear, dispara autenticação de novo
  useEffect(() => {
    if (user && !unlocked && !authenticating) {
      authenticate();
    }
  }, [unlocked, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user && !unlocked) {
    return (
      <View style={[styles.container, { backgroundColor: colors.brandBackground }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.brandPrimaryTint }]}>
          <Ionicons name="lock-closed" size={40} color={colors.brandPrimaryDark} />
        </View>
        <Text style={[styles.title, { color: colors.brandTextPrimary }]}>App bloqueado</Text>
        <Text style={[styles.subtitle, { color: colors.brandTextSecondary }]}>
          {error ?? 'Use o Face ID pra desbloquear.'}
        </Text>

        <Pressable
          onPress={authenticate}
          disabled={authenticating}
          style={[styles.button, { backgroundColor: colors.brandPrimaryDark }]}
        >
          {authenticating ? (
            <LoadingDog size={28} color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="finger-print" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Desbloquear</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, marginTop: 12, minWidth: 200 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
