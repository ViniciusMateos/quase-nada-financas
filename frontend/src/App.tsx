import 'react-native-gesture-handler';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { DebugOverlay } from '@/ui/DebugOverlay';

function AppShell() {
  const { colors } = useTheme();
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandBackground }}>
            <ActivityIndicator color={colors.brandPrimaryDark} />
          </View>
        }
      >
        <RootNavigator />
      </Suspense>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
          <DebugOverlay />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
