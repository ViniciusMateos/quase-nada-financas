import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import DashboardScreen from '@/screens/DashboardScreen';
import AccountsScreen from '@/screens/AccountsScreen';
import TransactionsScreen from '@/screens/TransactionsScreen';
import CategoriesScreen from '@/screens/CategoriesScreen';
import SubscriptionsScreen from '@/screens/SubscriptionsScreen';
import InstallmentsScreen from '@/screens/InstallmentsScreen';
import InvestmentsScreen from '@/screens/InvestmentsScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import { TopTabBar } from '@/ui/TopTabBar';

const Tab = createBottomTabNavigator();

export function AppTabs() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarPosition: 'top',
        sceneStyle: { backgroundColor: colors.brandBackground },
      }}
      tabBar={(props) => <TopTabBar {...props} topInset={insets.top + 8} />}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Transacoes" component={TransactionsScreen} />
      <Tab.Screen name="Categorias" component={CategoriesScreen} />
      <Tab.Screen name="Assinaturas" component={SubscriptionsScreen} />
      <Tab.Screen name="Parcelamentos" component={InstallmentsScreen} />
      <Tab.Screen name="Investimentos" component={InvestmentsScreen} />
      <Tab.Screen name="Contas" component={AccountsScreen} />
      <Tab.Screen name="Configuracoes" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
