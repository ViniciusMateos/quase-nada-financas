import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/contexts/AuthContext';
import { AppTabs } from '@/navigation/AppTabs';
import { theme } from '@/theme/theme';

const LoginScreen = React.lazy(() => import('@/screens/LoginScreen'));
const SplashScreen = React.lazy(() => import('@/screens/SplashScreen'));
const ConnectBankScreen = React.lazy(() => import('@/screens/ConnectBankScreen'));
const TransactionDetailScreen = React.lazy(() => import('@/screens/TransactionDetailScreen'));
const EditCategorySheet = React.lazy(() => import('@/screens/EditCategorySheet'));
const ConnectBinanceScreen = React.lazy(() => import('@/screens/ConnectBinanceScreen'));
const NewOrderSheet = React.lazy(() => import('@/screens/NewOrderSheet'));
const OrderResultScreen = React.lazy(() => import('@/screens/OrderResultScreen'));

const Stack = createNativeStackNavigator();

function RouteFallback() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={theme.colors.brandPrimaryDark} /></View>;
}

export function RootNavigator() {
  const { user, booting } = useAuth();
  return (
    <NavigationContainer>
      <Suspense fallback={<RouteFallback />}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {booting ? (
            <Stack.Screen name="Splash" component={SplashScreen} />
          ) : user ? (
            <>
              <Stack.Screen name="AppTabs" component={AppTabs} />
              <Stack.Screen name="ConnectBank" component={ConnectBankScreen} options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
              <Stack.Screen name="EditCategory" component={EditCategorySheet} options={{ presentation: 'transparentModal' }} />
              <Stack.Screen name="ConnectBinance" component={ConnectBinanceScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="NewOrder" component={NewOrderSheet} options={{ presentation: 'transparentModal' }} />
              <Stack.Screen name="OrderResult" component={OrderResultScreen} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </Suspense>
    </NavigationContainer>
  );
}
