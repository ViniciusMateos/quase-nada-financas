import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, Pressable, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { normalizeError } from '@/lib/errorMap';
import { categoriesService } from '@/services/categories.service';
import { transactionsService } from '@/services/transactions.service';
import { theme } from '@/theme/theme';
import { Button } from '@/ui/Button';
import type { Category, Transaction } from '@/types/api.types';

export default function EditCategorySheet() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tx = route.params.transaction as Transaction;
  const [items, setItems] = useState<Category[]>([]);
  const [selected, setSelected] = useState(tx.categoryId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { categoriesService.list().then(setItems).catch((err) => setError(normalizeError(err).message)); }, []);

  async function save() {
    setSaving(true);
    try {
      await transactionsService.updateCategory(tx.id, selected);
      navigation.goBack();
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Selecionar Categoria</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={items}
          numColumns={4}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={[styles.badge, selected === item.id && styles.selected]} onPress={() => setSelected(item.id)} disabled={saving}>
              <Text style={styles.badgeIcon}>{item.icon || '$'}</Text>
              <Text style={styles.badgeText}>{item.name}</Text>
            </Pressable>
          )}
        />
        <Button label="Salvar" loading={saving} disabled={!selected} onPress={save} />
        <Button label="Cancelar" variant="secondary" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.brandOverlay },
  sheet: { minHeight: '60%', padding: 16, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.colors.brandSurface },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: theme.colors.brandDivider, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  error: { color: theme.colors.brandTextError, fontWeight: '700', marginBottom: 8 },
  badge: { width: '25%', height: 84, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md },
  selected: { backgroundColor: theme.colors.brandPrimaryTint, borderWidth: 2, borderColor: theme.colors.brandPrimary },
  badgeIcon: { fontSize: 22 },
  badgeText: { fontSize: 11, textAlign: 'center', color: theme.colors.brandTextSecondary }
});
