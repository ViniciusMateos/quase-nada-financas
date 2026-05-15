import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/hooks/useDashboard';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { theme } from '@/theme/theme';
import { ErrorState, EmptyState, Skeleton } from '@/ui/States';
import { TransactionCard } from '@/ui/Cards';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { data, loading, refreshing, error, refresh, retry } = useDashboard();

  if (loading) {
    return (
      <View style={styles.container}>
        <Skeleton height={120} />
        <Skeleton height={96} />
        <Skeleton height={240} />
      </View>
    );
  }

  if (error || !data) {
    return <ErrorState subtitle={error || undefined} onRetry={retry} />;
  }

  const topCategories = data.topCategories ?? [];
  const recentTransactions = data.recentTransactions ?? [];

  const totalBalance = data.totalBalance ?? 0;
  const monthlyIncome = data.monthlyIncome ?? 0;
  const monthlyExpenses = data.monthlyExpenses ?? 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Text style={styles.hello}>
        Ola, {user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuario'}
      </Text>

      <Text style={styles.date}>{formatDate(new Date())}</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Saldo em contas</Text>
        <Text style={styles.balance}>{formatCurrency(totalBalance)}</Text>
      </View>

      <View style={styles.summary}>
        <View>
          <Text style={styles.meta}>Receitas</Text>
          <Text style={styles.income}>{formatCurrency(monthlyIncome)}</Text>
        </View>

        <View>
          <Text style={styles.meta}>Despesas</Text>
          <Text style={styles.expense}>{formatCurrency(monthlyExpenses)}</Text>
        </View>
      </View>

      <Text style={styles.section}>Maiores Categorias</Text>

      {topCategories.length === 0 ? (
        <EmptyState title="Sem categorias neste mes" />
      ) : (
        topCategories.map((cat) => (
          <View key={cat.categoryId ?? cat.categoryName} style={styles.categoryRow}>
            <Text style={styles.categoryName}>
              {cat.categoryIcon || '$'} {cat.categoryName || 'Categoria'}
            </Text>
            <Text>{formatCurrency(cat.total ?? 0)}</Text>
          </View>
        ))
      )}

      <Text style={styles.section}>Transacoes Recentes</Text>

      {recentTransactions.length === 0 ? (
        <EmptyState title="Nenhuma transacao ainda" />
      ) : (
        recentTransactions.map((tx) => (
          <TransactionCard
            key={tx.id}
            item={tx}
            onPress={() => navigation.navigate('TransactionDetail', { transaction: tx })}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.brandBackground,
    padding: 16
  },
  hello: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.brandTextPrimary
  },
  date: {
    color: theme.colors.brandTextSecondary,
    marginTop: 4
  },
  balanceCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.brandPrimaryDark
  },
  balanceLabel: {
    color: '#FFFFFF',
    opacity: 0.8
  },
  balance: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900'
  },
  summary: {
    marginTop: 16,
    padding: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandSurface,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  meta: {
    color: theme.colors.brandTextSecondary
  },
  income: {
    color: theme.colors.brandTextPositive,
    fontWeight: '800',
    fontSize: 17
  },
  expense: {
    color: theme.colors.brandTextNegative,
    fontWeight: '800',
    fontSize: 17
  },
  section: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.brandTextPrimary
  },
  categoryRow: {
    padding: 14,
    backgroundColor: theme.colors.brandSurface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.brandDivider,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  categoryName: {
    fontWeight: '700',
    color: theme.colors.brandTextPrimary
  }
});