import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { LoadingDog } from '@/ui/LoadingDog';

export default function SplashScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const dogSize = Math.min(width * 0.6, 240);

  return (
    <View style={[styles.container, { backgroundColor: colors.brandPrimaryDark }]}>
      <StatusBar style="light" />
      <LoadingDog size={dogSize} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
