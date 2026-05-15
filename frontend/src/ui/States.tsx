import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/ui/Button';
import { theme } from '@/theme/theme';

export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <View style={styles.overlay}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      {message ? <Text style={styles.overlayText}>{message}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, subtitle, actionLabel, onAction }: { title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.state}>
      <Ionicons name="file-tray-outline" size={64} color={theme.colors.brandTextSecondary} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel ? <Button label={actionLabel} variant="secondary" onPress={onAction} style={{ marginTop: 24 }} /> : null}
    </View>
  );
}

export function ErrorState({ title = 'Algo deu errado', subtitle = 'Verifique sua conexao e tente novamente.', onRetry }: { title?: string; subtitle?: string; onRetry: () => void }) {
  return (
    <View style={styles.state}>
      <Ionicons name="cloud-offline-outline" size={64} color={theme.colors.brandTextSecondary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Button label="Tentar novamente" onPress={onRetry} style={{ marginTop: 24, alignSelf: 'center', paddingHorizontal: 32 }} />
    </View>
  );
}

export function Skeleton({ height = 68 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 999, backgroundColor: theme.colors.brandOverlay, alignItems: 'center', justifyContent: 'center' },
  overlayText: { marginTop: 12, color: '#FFFFFF', fontSize: 14 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { marginTop: 20, fontSize: 18, fontWeight: '700', color: theme.colors.brandTextPrimary, textAlign: 'center' },
  subtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, color: theme.colors.brandTextSecondary, textAlign: 'center' },
  skeleton: { borderRadius: theme.radius.md, backgroundColor: theme.colors.brandSkeleton, marginBottom: 12 }
});
