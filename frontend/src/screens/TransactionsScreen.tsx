import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTransactions } from '@/hooks/useTransactions';
import { theme } from '@/theme/theme';
import { TransactionCard } from '@/ui/Cards';
import { EmptyState, ErrorState, Skeleton } from '@/ui/States';

export default function TransactionsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { items, loading, loadingMore, error, reload, loadMore } = useTransactions({ accountId: route.params?.accountId });

  if (loading) return <View style={styles.container}><Skeleton /><Skeleton /><Skeleton /><Skeleton /></View>;
  if (error) return <ErrorState subtitle={error} onRetry={reload} />;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transacoes</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionCard item={item} onPress={() => navigation.navigate('TransactionDetail', { transaction: item })} />}
        onEndReached={() => loadMore()}
        ListEmptyComponent={<EmptyState title="Nenhuma transacao encontrada" actionLabel={route.params?.accountId ? 'Limpar filtros' : undefined} />}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.brandPrimaryDark} /> : <Text style={styles.footer}>Fim da lista</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.brandBackground },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12, color: theme.colors.brandTextPrimary },
  footer: { textAlign: 'center', padding: 16, color: theme.colors.brandTextSecondary }
});
