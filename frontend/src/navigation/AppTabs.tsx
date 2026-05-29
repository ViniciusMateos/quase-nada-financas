import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import DashboardScreen from '@/screens/DashboardScreen';
import AccountsScreen from '@/screens/AccountsScreen';
import TransactionsScreen from '@/screens/TransactionsScreen';
import CategoriesScreen from '@/screens/CategoriesScreen';
import SubscriptionsScreen from '@/screens/SubscriptionsScreen';
import InstallmentsScreen from '@/screens/InstallmentsScreen';
import InvestmentsScreen from '@/screens/InvestmentsScreen';
import AssetsScreen from '@/screens/AssetsScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import { TopTabBar } from '@/ui/TopTabBar';

const Tab = createBottomTabNavigator();

export function AppTabs() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isDemo } = useAuth();
  // No modo demo a faixa do topo já consome o safe-area (notch); recontar o
  // insets.top aqui criava um espaço duplo entre a faixa e as abas.
  const topInset = (isDemo ? 0 : insets.top) + 8;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarPosition: 'top',
        sceneStyle: { backgroundColor: colors.brandBackground },
      }}
      tabBar={(props) => <TopTabBar {...props} topInset={topInset} />}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Transacoes" component={TransactionsScreen} />
      <Tab.Screen name="Categorias" component={CategoriesScreen} />
      <Tab.Screen name="Assinaturas" component={SubscriptionsScreen} />
      <Tab.Screen name="Parcelamentos" component={InstallmentsScreen} />
      <Tab.Screen name="Investimentos" component={InvestmentsScreen} />
      <Tab.Screen name="Ativos" component={AssetsScreen} />
      <Tab.Screen name="Contas" component={AccountsScreen} />
      <Tab.Screen name="Configuracoes" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
