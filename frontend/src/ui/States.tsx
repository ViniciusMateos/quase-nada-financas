import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';

export function LoadingOverlay({ message }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.overlay, { backgroundColor: colors.brandOverlay }]}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      {message ? <Text style={styles.overlayText}>{message}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, subtitle, actionLabel, onAction }: { title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.state}>
      <Ionicons name="file-tray-outline" size={64} color={colors.brandTextSecondary} />
      <Text style={[styles.title, { color: colors.brandTextPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.brandTextSecondary }]}>{subtitle}</Text> : null}
      {actionLabel ? <Button label={actionLabel} variant="secondary" onPress={onAction} style={{ marginTop: 24 }} /> : null}
    </View>
  );
}

export function ErrorState({ title = 'Algo deu errado', subtitle = 'Verifique sua conexao e tente novamente.', onRetry }: { title?: string; subtitle?: string; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.state}>
      <Ionicons name="cloud-offline-outline" size={64} color={colors.brandTextSecondary} />
      <Text style={[styles.title, { color: colors.brandTextPrimary }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.brandTextSecondary }]}>{subtitle}</Text>
      <Button label="Tentar novamente" onPress={onRetry} style={{ marginTop: 24, alignSelf: 'center', paddingHorizontal: 32 }} />
    </View>
  );
}

export function Skeleton({ height = 68 }: { height?: number }) {
  const { colors, radius } = useTheme();
  return <View style={[{ height, borderRadius: radius.md, backgroundColor: colors.brandSkeleton, marginBottom: 12 }]} />;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 999, alignItems: 'center', justifyContent: 'center' },
  overlayText: { marginTop: 12, color: '#FFFFFF', fontSize: 14 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { marginTop: 20, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
