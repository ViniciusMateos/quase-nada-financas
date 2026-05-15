import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { theme } from '@/theme/theme';
import { Button } from '@/ui/Button';

export default function SettingsScreen() {
  const { user, logout, loading } = useAuth();
  const [biometrics, setBiometrics] = useState(Boolean(user?.biometricsEnabled));
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuracoes</Text>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name || user?.email}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <View style={styles.row}>
        <View><Text style={styles.name}>Biometria</Text><Text style={styles.email}>Usar Face ID em ordens</Text></View>
        <Switch value={biometrics} onValueChange={setBiometrics} />
      </View>
      <Button
        label="Sair"
        variant="destructive"
        loading={loading}
        icon="log-out-outline"
        onPress={() => Alert.alert('Sair da conta?', 'Voce precisara entrar novamente.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: logout }
        ])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16, backgroundColor: theme.colors.brandBackground },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.brandTextPrimary },
  card: { padding: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandSurface },
  row: { padding: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandSurface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '800', color: theme.colors.brandTextPrimary },
  email: { marginTop: 4, color: theme.colors.brandTextSecondary }
});
