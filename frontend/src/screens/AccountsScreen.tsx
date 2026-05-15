import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAccounts } from '@/hooks/useAccounts';
import { theme } from '@/theme/theme';
import { Button } from '@/ui/Button';
import { AccountCard } from '@/ui/Cards';
import { EmptyState, ErrorState, Skeleton } from '@/ui/States';

export default function AccountsScreen() {
  const navigation = useNavigation<any>();
  const { items, loading, error, load, remove, sync } = useAccounts();

  const accounts = Array.isArray(items) ? items : [];

  if (loading) {
    return (
      <View style={styles.container}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </View>
    );
  }

  if (error) {
    return <ErrorState subtitle={error} onRetry={load} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Minhas Contas</Text>

        <Button
          label="Conectar"
          icon="add"
          onPress={() => navigation.navigate('ConnectBank')}
          style={{ width: 136 }}
        />
      </View>

      {accounts.length === 0 ? (
        <EmptyState
          title="Nenhuma conta conectada"
          actionLabel="Conectar minha primeira conta"
          onAction={() => navigation.navigate('ConnectBank')}
        />
      ) : (
        accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onPress={() => navigation.navigate('Transacoes', { accountId: account.id })}
            onDelete={() => remove(account.id)}
            onSync={() => sync(account.id)}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.brandBackground
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.brandTextPrimary
  }
});