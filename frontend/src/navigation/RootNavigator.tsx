import { Suspense } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LoadingDog } from '@/ui/LoadingDog';
import { AppTabs } from '@/navigation/AppTabs';
import AccountHubScreen from '@/screens/AccountHubScreen';
import LoginScreen from '@/screens/LoginScreen';
import RegisterScreen from '@/screens/RegisterScreen';
import SplashScreen from '@/screens/SplashScreen';
import ConnectBankScreen from '@/screens/ConnectBankScreen';
import TransactionDetailScreen from '@/screens/TransactionDetailScreen';
import CategoryDetailScreen from '@/screens/CategoryDetailScreen';
import EditTransactionSheet from '@/screens/EditTransactionSheet';
import ConnectBinanceScreen from '@/screens/ConnectBinanceScreen';
import NewOrderSheet from '@/screens/NewOrderSheet';
import OrderResultScreen from '@/screens/OrderResultScreen';
import InvestmentRulesScreen from '@/screens/InvestmentRulesScreen';
import EditInvestmentRuleScreen from '@/screens/EditInvestmentRuleScreen';
import PendingActionsScreen from '@/screens/PendingActionsScreen';
import WeeklySummaryScreen from '@/screens/WeeklySummaryScreen';
import ChangePasswordScreen from '@/screens/ChangePasswordScreen';

const Stack = createNativeStackNavigator();

function RouteFallback() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandBackground }}>
      <LoadingDog size={56} color={colors.brandPrimaryDark} />
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
                options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
              />
              <Stack.Screen
                name="ConnectBinance"
                component={ConnectBinanceScreen}
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="NewOrder"
                component={NewOrderSheet}
                options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
              />
              <Stack.Screen name="OrderResult" component={OrderResultScreen} options={{ animation: 'fade' }} />
              <Stack.Screen name="InvestmentRules" component={InvestmentRulesScreen} />
              <Stack.Screen name="EditInvestmentRule" component={EditInvestmentRuleScreen} />
              <Stack.Screen name="PendingActions" component={PendingActionsScreen} />
              <Stack.Screen name="WeeklySummary" component={WeeklySummaryScreen} />
              <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="AccountHub" component={AccountHubScreen} options={{ animation: 'fade' }} />
              <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
            </>
          )}
        </Stack.Navigator>
      </Suspense>
    </NavigationContainer>
  );
}
