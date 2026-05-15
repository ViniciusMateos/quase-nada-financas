import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { theme } from '@/theme/theme';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.logo}>Quase Nada Financas</Text>
      <ActivityIndicator color="#FFFFFF" style={{ marginTop: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.brandPrimaryDark },
  logo: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' }
});
