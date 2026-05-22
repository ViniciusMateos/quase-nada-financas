import 'react-native-gesture-handler';
import { Suspense } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { DataRefreshProvider } from '@/contexts/DataRefreshContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { AppLockGate } from '@/ui/AppLockGate';
import { LoadingDog } from '@/ui/LoadingDog';

function AppShell() {
  const { colors } = useTheme();
  return (
    <AuthProvider>
      <DataRefreshProvider>
        <Suspense
          fallback={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandBackground }}>
              <LoadingDog size={56} color={colors.brandPrimaryDark} />
            </View>
          }
        >
          <AppLockGate>
            <RootNavigator />
          </AppLockGate>
        </Suspense>
      </DataRefreshProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
