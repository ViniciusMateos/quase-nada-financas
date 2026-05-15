import 'react-native-gesture-handler';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { theme } from '@/theme/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Suspense fallback={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={theme.colors.brandPrimaryDark} /></View>}>
          <RootNavigator />
        </Suspense>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
