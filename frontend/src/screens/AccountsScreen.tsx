import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAccounts } from '@/hooks/useAccounts';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/ui/Button';
import { AccountCard } from '@/ui/Cards';
import { EmptyState, ErrorState, Skeleton } from '@/ui/States';
import { TabScreen } from '@/ui/TabScreen';

export default function AccountsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { items, loading, error, load, remove, sync } = useAccounts();

  const accounts = Array.isArray(items) ? items : [];

  if (loading) {
    return (
      <TabScreen>
        <Skeleton /><Skeleton /><Skeleton />
      </TabScreen>
    );
  }

  if (error) {
    return (
      <TabScreen>
        <ErrorState subtitle={error} onRetry={load} />
      </TabScreen>
    );
  }

  return (
    <TabScreen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Minhas contas</Text>
        <Button
          label="Conectar"
          icon="add"
          onPress={() => navigation.navigate('ConnectBank')}
          style={{ width: 136, minHeight: 44 }}
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
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800' },
});
