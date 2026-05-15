import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/theme/theme';

const DashboardScreen = React.lazy(() => import('@/screens/DashboardScreen'));
const AccountsScreen = React.lazy(() => import('@/screens/AccountsScreen'));
const TransactionsScreen = React.lazy(() => import('@/screens/TransactionsScreen'));
const InvestmentsScreen = React.lazy(() => import('@/screens/InvestmentsScreen'));
const SettingsScreen = React.lazy(() => import('@/screens/SettingsScreen'));
const Tab = createBottomTabNavigator();

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brandPrimaryDark,
        tabBarInactiveTintColor: theme.colors.brandTextSecondary,
        tabBarIcon: ({ color, focused }) => {
          const map: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
            Dashboard: ['grid-outline', 'grid'],
            Contas: ['wallet-outline', 'wallet'],
            Transacoes: ['swap-horizontal-outline', 'swap-horizontal'],
            Investimentos: ['trending-up-outline', 'trending-up'],
            Configuracoes: ['settings-outline', 'settings']
          };
          return <Ionicons name={focused ? map[route.name][1] : map[route.name][0]} size={22} color={color} />;
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Contas" component={AccountsScreen} />
      <Tab.Screen name="Transacoes" component={TransactionsScreen} options={{ title: 'Transacoes' }} />
      <Tab.Screen name="Investimentos" component={InvestmentsScreen} />
      <Tab.Screen name="Configuracoes" component={SettingsScreen} options={{ title: 'Ajustes' }} />
    </Tab.Navigator>
  );
}
