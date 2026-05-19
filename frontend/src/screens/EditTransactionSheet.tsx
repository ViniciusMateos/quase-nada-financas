import { useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataRefresh } from '@/contexts/DataRefreshContext';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { normalizeError } from '@/lib/errorMap';
import { categoriesService } from '@/services/categories.service';
import { transactionsService } from '@/services/transactions.service';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import type { Category, Transaction } from '@/types/api.types';

export const TRANSACTION_UPDATED_EVENT = 'transaction:updated';
export type TransactionUpdatedPayload = { updated: Transaction; affected: number };

type SubMode = 'auto' | 'on' | 'off';

function modeFromValue(v: boolean | null | undefined): SubMode {
  if (v === true) return 'on';
  if (v === false) return 'off';
  return 'auto';
}

function valueFromMode(m: SubMode): boolean | null {
  if (m === 'on') return true;
  if (m === 'off') return false;
  return null;
}

export default function EditTransactionSheet() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, radius } = useTheme();
  const tx = route.params.transaction as Transaction;
  const bumpRefresh = useDataRefresh();

  const [items, setItems] = useState<Category[]>([]);
  const [alias, setAlias] = useState(tx.alias ?? '');
  const [selectedCategory, setSelectedCategory] = useState(tx.categoryId || '');
  const [subMode, setSubMode] = useState<SubMode>(modeFromValue(tx.isSubscriptionOverride));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    categoriesService
      .list()
      .then((res: any) => {
        // Backend devolve { categories: [...] }, mas o tipo do service fala que é Category[].
        // Aceita ambos os formatos por defesa.
        const list: Category[] = Array.isArray(res) ? res : res?.categories ?? [];
        setItems(list);
      })
      .catch((err) => setError(normalizeError(err).message));
  }, []);

  const originalLabel = useMemo(() => tx.originalDescription ?? tx.description, [tx]);

  const aliasChanged = (alias.trim() || null) !== (tx.alias ?? null);
  const categoryChanged = selectedCategory && selectedCategory !== tx.categoryId;
  const subChanged = valueFromMode(subMode) !== (tx.isSubscriptionOverride ?? null);
  const hasChanges = aliasChanged || categoryChanged || subChanged;

  async function save() {
    if (!hasChanges) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: any = {};
      if (aliasChanged) body.alias = alias.trim() ? alias.trim() : null;
      if (categoryChanged) body.categoryId = selectedCategory;
      if (subChanged) body.isSubscriptionOverride = valueFromMode(subMode);

      const res = await transactionsService.update(tx.id, body);
      const payload: TransactionUpdatedPayload = {
        updated: res.updated,
        affected: res.affectedSimilar,
      };
      DeviceEventEmitter.emit(TRANSACTION_UPDATED_EVENT, payload);
      bumpRefresh();
      navigation.goBack();
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet onClose={() => navigation.goBack()}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={[styles.title, { color: colors.brandTextPrimary }]}>Editar transação</Text>
        <Text style={[styles.helper, { color: colors.brandTextSecondary }]}>
          As mudanças se aplicam a todas as transações parecidas (mesmo estabelecimento).
        </Text>

        {error ? <Text style={[styles.error, { color: colors.brandTextError }]}>{error}</Text> : null}

        <Text style={[styles.label, { color: colors.brandTextSecondary }]}>Apelido</Text>
        <TextInput
          value={alias}
          onChangeText={setAlias}
          placeholder={originalLabel}
          placeholderTextColor={colors.brandTextSecondary}
          style={[
            styles.input,
            {
              backgroundColor: colors.brandSurfaceAlt,
              color: colors.brandTextPrimary,
              borderColor: colors.brandDivider,
              borderRadius: radius.md,
            },
          ]}
          maxLength={120}
          editable={!saving}
        />
        <Text style={[styles.helperTiny, { color: colors.brandTextSecondary }]}>
          Original: {originalLabel}
        </Text>

        <Text style={[styles.label, { color: colors.brandTextSecondary, marginTop: 18 }]}>Categoria</Text>
        <View style={styles.catGrid}>
          {items.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.badge,
                  {
                    backgroundColor: isSelected ? colors.brandPrimaryTint : colors.brandSurfaceAlt,
                    borderColor: isSelected ? colors.brandPrimary : 'transparent',
                    borderRadius: radius.md,
                  },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
                disabled={saving}
              >
                <CategoryIcon icon={cat.icon} color={cat.color || colors.brandPrimary} size={22} />
                <Text
                  style={[
                    styles.badgeText,
                    { color: isSelected ? colors.brandPrimaryDark : colors.brandTextSecondary },
                  ]}
                  numberOfLines={2}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.brandTextSecondary, marginTop: 18 }]}>É uma assinatura?</Text>
        <View style={styles.subRow}>
          {(
            [
              { mode: 'auto', label: 'Automático', icon: 'sparkles-outline' as const },
              { mode: 'on', label: 'É assinatura', icon: 'repeat' as const },
              { mode: 'off', label: 'Não é', icon: 'close-circle-outline' as const },
            ] as { mode: SubMode; label: string; icon: keyof typeof Ionicons.glyphMap }[]
          ).map((opt) => {
            const active = subMode === opt.mode;
            return (
              <Pressable
                key={opt.mode}
                onPress={() => setSubMode(opt.mode)}
                disabled={saving}
                style={[
                  styles.subOpt,
                  {
                    backgroundColor: active ? colors.brandPrimaryTint : colors.brandSurfaceAlt,
                    borderColor: active ? colors.brandPrimary : 'transparent',
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={16}
                  color={active ? colors.brandPrimaryDark : colors.brandTextSecondary}
                />
                <Text
                  style={[
                    styles.subOptText,
                    { color: active ? colors.brandPrimaryDark : colors.brandTextSecondary },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.helperTiny, { color: colors.brandTextSecondary }]}>
          {subMode === 'auto'
            ? 'O app decide automaticamente baseado no padrão de cobrança.'
            : subMode === 'on'
            ? 'Sempre aparecerá na aba Assinaturas.'
            : 'Nunca aparecerá na aba Assinaturas (mesmo se parecer recorrente).'}
        </Text>

        <Button
          label="Salvar"
          loading={saving}
          disabled={saving}
          onPress={save}
          style={{ marginTop: 18 }}
        />
        <Button
          label="Cancelar"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 8 }}
          disabled={saving}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  helper: { fontSize: 12, marginBottom: 14 },
  error: { fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  helperTiny: { fontSize: 11, marginTop: 6 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    width: '31.5%',
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  badgeIcon: { fontSize: 24 },
  badgeText: { fontSize: 11, textAlign: 'center', fontWeight: '600', lineHeight: 14 },
  subRow: { flexDirection: 'row', gap: 8 },
  subOpt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1.5,
  },
  subOptText: { fontSize: 12, fontWeight: '700' },
});
