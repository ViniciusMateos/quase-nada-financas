import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAccounts } from '@/hooks/useAccounts';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { useForegroundRefresh } from '@/hooks/useForegroundRefresh';
import { useTheme } from '@/contexts/ThemeContext';
import { accountsService } from '@/services/accounts.service';
import { Button } from '@/ui/Button';
import { AccountCard } from '@/ui/Cards';
import { EmptyState, ErrorState, Skeleton } from '@/ui/States';
import { TabScreen, TabScreenScroll } from '@/ui/TabScreen';

export default function AccountsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { items, loading, error, load, remove, sync, rename } = useAccounts();
  const [refreshing, setRefreshing] = useState(false);

  useFocusRefresh(load);

  const accounts = Array.isArray(items) ? items : [];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled(accounts.map((acc) => accountsService.sync(acc.id)));
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [accounts, load]);

  const handleRename = useCallback((accountId: string, currentLabel: string) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Renomear conta',
        'Escolha um nome para essa conexão (ex: Nubank, Mercado Pago).',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Salvar',
            onPress: (text) => {
              const next = (text ?? '').trim();
              rename(accountId, next || null).catch((err) => Alert.alert('Erro', String(err)));
            },
          },
        ],
        'plain-text',
        currentLabel
      );
    } else {
      // Android: Alert.prompt não existe nativamente — fallback simples
      Alert.alert('Renomear conta', 'No Android use o iOS por enquanto, vamos adicionar modal depois.');
    }
  }, [rename]);

  useForegroundRefresh(handleRefresh);

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
    <TabScreenScroll refreshing={refreshing} onRefresh={handleRefresh}>
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
            onSubPress={() => navigation.navigate('Transacoes', { accountId: account.id })}
            onRename={() => handleRename(account.id, account.customName || account.bankName)}
          />
        ))
      )}
    </TabScreenScroll>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800' },
});
