import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';

export default function SplashScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.brandPrimaryDark }]}>
      <StatusBar style="light" />
      <Text style={styles.logo}>Quase Nada Finanças</Text>
      <ActivityIndicator color="#FFFFFF" style={{ marginTop: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
});
