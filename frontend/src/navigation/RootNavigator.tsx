import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { AppTabs } from '@/navigation/AppTabs';
import LoginScreen from '@/screens/LoginScreen';
import SplashScreen from '@/screens/SplashScreen';
import ConnectBankScreen from '@/screens/ConnectBankScreen';
import TransactionDetailScreen from '@/screens/TransactionDetailScreen';
import CategoryDetailScreen from '@/screens/CategoryDetailScreen';
import EditTransactionSheet from '@/screens/EditTransactionSheet';
import ConnectBinanceScreen from '@/screens/ConnectBinanceScreen';
import NewOrderSheet from '@/screens/NewOrderSheet';
import OrderResultScreen from '@/screens/OrderResultScreen';

const Stack = createNativeStackNavigator();

function RouteFallback() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandBackground }}>
      <ActivityIndicator color={colors.brandPrimaryDark} />
    </View>
  );
}

export function RootNavigator() {
  const { user, booting } = useAuth();
  const { mode, colors } = useTheme();

  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.brandBackground,
      card: colors.brandSurface,
      text: colors.brandTextPrimary,
      primary: colors.brandPrimaryDark,
      border: colors.brandDivider,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Suspense fallback={<RouteFallback />}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.brandBackground },
            animation: 'slide_from_right',
          }}
        >
          {booting ? (
            <Stack.Screen name="Splash" component={SplashScreen} />
          ) : user ? (
            <>
              <Stack.Screen name="AppTabs" component={AppTabs} options={{ animation: 'fade' }} />
              <Stack.Screen
                name="ConnectBank"
                component={ConnectBankScreen}
                options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
              <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
              <Stack.Screen
                name="EditTransaction"
                component={EditTransactionSheet}
                options={{ presentation: 'transparentModal', animation: 'none' }}
              />
              <Stack.Screen
                name="ConnectBinance"
                component={ConnectBinanceScreen}
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="NewOrder"
                component={NewOrderSheet}
                options={{ presentation: 'transparentModal', animation: 'none' }}
              />
              <Stack.Screen name="OrderResult" component={OrderResultScreen} options={{ animation: 'fade' }} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
          )}
        </Stack.Navigator>
      </Suspense>
    </NavigationContainer>
  );
}
