import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/ui/Button';
import { TabScreen } from '@/ui/TabScreen';

export default function SettingsScreen() {
  const { user, logout, loading } = useAuth();
  const { colors, radius, shadows, mode, setMode } = useTheme();
  const [biometrics, setBiometrics] = useState(Boolean(user?.biometricsEnabled));

  return (
    <TabScreen>
      <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Ajustes</Text>

      <View style={[styles.card, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors.brandPrimaryTint }]}>
            <Text style={[styles.avatarText, { color: colors.brandPrimaryDark }]}>
              {(user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.brandTextPrimary }]}>{user?.name || 'Conta'}</Text>
            <Text style={[styles.email, { color: colors.brandTextSecondary }]}>{user?.email}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.section, { color: colors.brandTextSecondary }]}>Aparência</Text>
      <View style={[styles.card, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
        <View style={styles.themeRow}>
          <ThemeChoice
            label="Claro"
            icon="sunny-outline"
            active={mode === 'light'}
            onPress={() => setMode('light')}
          />
          <ThemeChoice
            label="Escuro"
            icon="moon-outline"
            active={mode === 'dark'}
            onPress={() => setMode('dark')}
          />
        </View>
      </View>

      <Text style={[styles.section, { color: colors.brandTextSecondary }]}>Segurança</Text>
      <View style={[styles.card, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.brandTextPrimary }]}>Biometria</Text>
            <Text style={[styles.email, { color: colors.brandTextSecondary }]}>Use Face ID ao confirmar ordens</Text>
          </View>
          <Switch
            value={biometrics}
            onValueChange={setBiometrics}
            trackColor={{ false: colors.brandDivider, true: colors.brandPrimary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View style={{ marginTop: 28 }}>
        <Button
          label="Sair"
          variant="destructive"
          loading={loading}
          icon="log-out-outline"
          onPress={() =>
            Alert.alert('Sair da conta?', 'Você vai precisar entrar de novo.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sair', style: 'destructive', onPress: logout },
            ])
          }
        />
      </View>
    </TabScreen>
  );
}

function ThemeChoice({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof import('@expo/vector-icons/build/Ionicons').default.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, radius, mode } = useTheme();
  const bg = active ? colors.brandPillBgActive : 'transparent';
  const border = active ? colors.brandPrimary : colors.brandDivider;
  const fg = active ? colors.brandPrimaryDark : colors.brandTextSecondary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        themeStyles.choice,
        {
          backgroundColor: bg,
          borderColor: border,
          borderRadius: radius.md,
        },
        active && {
          shadowColor: colors.brandPrimary,
          shadowOpacity: mode === 'dark' ? 0.5 : 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={fg} />
      <Text style={[themeStyles.choiceLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const themeStyles = StyleSheet.create({
  choice: { flex: 1, paddingVertical: 14, alignItems: 'center', gap: 6, borderWidth: 1 },
  choiceLabel: { fontWeight: '700', fontSize: 14 },
});

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16, gap: 6 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  card: { padding: 16 },
  section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 4, paddingLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '900', fontSize: 18 },
  name: { fontSize: 16, fontWeight: '800' },
  email: { marginTop: 4, fontSize: 13 },
  themeRow: { flexDirection: 'row', gap: 10 },
});
