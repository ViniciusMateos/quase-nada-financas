import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { transactionsService } from '@/services/transactions.service';
import { TabScreen } from '@/ui/TabScreen';
import { BottomSheet } from '@/ui/BottomSheet';
import { LoadingDog } from '@/ui/LoadingDog';
import type { Transaction } from '@/types/api.types';

type Mode = 'percent' | 'fixed';
type LinkedTx = { id: string; description: string; amount: number; date: string };
type Item = { id: string; label: string; mode: Mode };
type ItemMonthData = { value: string; checked: boolean; txs: LinkedTx[] };
type MonthData = { base: string; items: Record<string, ItemMonthData> };
type Distribution = {
  id: string;
  name: string;
  recurring: boolean;
  createdMonth: string; // 'YYYY-MM'
  items: Item[]; // estrutura (compartilhada entre meses)
  data: Record<string, MonthData>; // valores/checks/txs por mês
};

const STORAGE_KEY = 'qnf:distribution:v3';
const OLD_V2 = 'qnf:distribution:v2';
const OLD_V1 = 'qnf:distribution:v1';

function toNum(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

let idSeq = 0;
function newId(): string {
  idSeq += 1;
  return `d${Date.now()}_${idSeq}`;
}

const EMPTY_MD: MonthData = { base: '', items: {} };
function monthDataOf(d: Distribution, mk: string): MonthData {
  return d.data[mk] ?? EMPTY_MD;
}
function itemDataOf(md: MonthData, itemId: string): ItemMonthData {
  return md.items[itemId] ?? { value: '', checked: false, txs: [] };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DistribuicaoScreen() {
  const { colors, radius, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [dists, setDists] = useState<Distribution[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Picker
  const [pickerItemId, setPickerItemId] = useState<string | null>(null);
  const [pickerOffset, setPickerOffset] = useState(0);
  const [pickerTxs, setPickerTxs] = useState<Transaction[] | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const monthKey = useMemo(() => format(addMonths(new Date(), monthOffset), 'yyyy-MM'), [monthOffset]);
  const monthLabel = useMemo(() => capitalize(format(addMonths(new Date(), monthOffset), "LLLL 'de' yyyy", { locale: ptBR })), [monthOffset]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { dists?: Distribution[]; selectedId?: string };
          if (Array.isArray(parsed.dists)) {
            setDists(parsed.dists);
            setSelectedId(parsed.selectedId ?? parsed.dists[0]?.id ?? null);
            setLoaded(true);
            return;
          }
        }
        // Migração de v2/v1 → v3 (joga tudo no mês atual, não-recorrente).
        const nowMk = format(new Date(), 'yyyy-MM');
        let migrated: Distribution[] = [];
        const v2 = await AsyncStorage.getItem(OLD_V2);
        if (v2) {
          const p = JSON.parse(v2) as { dists?: any[] };
          migrated = (p.dists ?? []).map((d) => migrateOne(d.name, d.base, d.items, nowMk));
        } else {
          const v1 = await AsyncStorage.getItem(OLD_V1);
          if (v1) {
            const p = JSON.parse(v1) as { base?: string; items?: any[] };
            migrated = [migrateOne('Salário', p.base, p.items, nowMk)];
          }
        }
        if (migrated.length === 0) migrated = [emptyDist('Salário', nowMk, true)];
        setDists(migrated);
        setSelectedId(migrated[0].id);
      } catch {
        const nowMk = format(new Date(), 'yyyy-MM');
        const d = emptyDist('Salário', nowMk, true);
        setDists([d]);
        setSelectedId(d.id);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ dists, selectedId })).catch(() => undefined);
  }, [dists, selectedId, loaded]);

  // Distribuições visíveis no mês: recorrentes sempre; não-recorrentes só no mês criado.
  const visible = useMemo(
    () => dists.filter((d) => d.recurring || d.createdMonth === monthKey),
    [dists, monthKey]
  );
  const selected = visible.find((d) => d.id === selectedId) ?? visible[0] ?? null;
  const md = selected ? monthDataOf(selected, monthKey) : EMPTY_MD;
  const baseNum = toNum(md.base);

  const rows = useMemo(() => {
    if (!selected) return [];
    return selected.items.map((it) => {
      const d = itemDataOf(md, it.id);
      const v = toNum(d.value);
      const amount = it.mode === 'percent' ? (baseNum * v) / 100 : v;
      const pct = baseNum > 0 ? (amount / baseNum) * 100 : 0;
      return { ...it, ...d, amount, pct };
    });
  }, [selected, md, baseNum]);

  const totalAllocated = rows.reduce((s, r) => s + r.amount, 0);
  const remaining = baseNum - totalAllocated;
  const allocatedPct = baseNum > 0 ? (totalAllocated / baseNum) * 100 : 0;
  const over = remaining < -0.001;

  // ── mutações ────────────────────────────────────────────────────────────
  function patchDist(id: string, fn: (d: Distribution) => Distribution) {
    setDists((prev) => prev.map((d) => (d.id === id ? fn(d) : d)));
  }
  function patchMonth(fn: (m: MonthData) => MonthData) {
    if (!selected) return;
    patchDist(selected.id, (d) => ({ ...d, data: { ...d.data, [monthKey]: fn(monthDataOf(d, monthKey)) } }));
  }
  function setBase(v: string) {
    patchMonth((m) => ({ ...m, base: v }));
  }
  function patchItemData(itemId: string, patch: Partial<ItemMonthData>) {
    patchMonth((m) => ({ ...m, items: { ...m.items, [itemId]: { ...itemDataOf(m, itemId), ...patch } } }));
  }
  function patchItemStruct(itemId: string, patch: Partial<Item>) {
    if (!selected) return;
    patchDist(selected.id, (d) => ({ ...d, items: d.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }));
  }
  function addItem() {
    if (!selected) return;
    patchDist(selected.id, (d) => ({ ...d, items: [...d.items, { id: newId(), label: '', mode: 'percent' }] }));
  }
  function removeItem(itemId: string) {
    if (!selected) return;
    patchDist(selected.id, (d) => ({
      ...d,
      items: d.items.filter((it) => it.id !== itemId),
    }));
  }
  function toggleRecurring() {
    if (!selected) return;
    patchDist(selected.id, (d) => ({ ...d, recurring: !d.recurring }));
  }

  function addDistribution() {
    Alert.prompt?.('Nova distribuição', 'Nome (ex.: Salário, Freela, 13º)', (name?: string) => {
      const d = emptyDist((name ?? '').trim() || 'Distribuição', monthKey, false);
      setDists((prev) => [...prev, d]);
      setSelectedId(d.id);
    });
  }
  function renameSelected() {
    if (!selected) return;
    Alert.prompt?.('Renomear', 'Novo nome', (name?: string) => {
      const n = (name ?? '').trim();
      if (n) patchDist(selected.id, (d) => ({ ...d, name: n }));
    }, 'plain-text', selected.name);
  }
  function deleteSelected() {
    if (!selected) return;
    Alert.alert('Excluir distribuição?', `"${selected.name}" e todos os meses dela serão removidos.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => setDists((prev) => prev.filter((d) => d.id !== selected.id)),
      },
    ]);
  }

  // ── picker de transação (robusto: navega por mês) ─────────────────────────
  async function loadPickerMonth(offset: number) {
    setPickerOffset(offset);
    setPickerTxs(null);
    try {
      const d = addMonths(new Date(), offset);
      const res = await transactionsService.list({
        startDate: format(startOfMonth(d), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(d), 'yyyy-MM-dd'),
        limit: 200,
      });
      setPickerTxs(((res as any).items ?? []) as Transaction[]);
    } catch {
      setPickerTxs([]);
    }
  }
  function openPicker(itemId: string) {
    setPickerItemId(itemId);
    setPickerSearch('');
    loadPickerMonth(monthOffset);
  }
  function linkTx(tx: Transaction) {
    if (!pickerItemId) return;
    const link: LinkedTx = { id: tx.id, description: tx.alias || tx.description || 'Transação', amount: tx.amount, date: tx.occurredAt };
    patchItemData(pickerItemId, { txs: [...itemDataOf(md, pickerItemId).txs.filter((t) => t.id !== link.id), link] });
    setPickerItemId(null);
  }
  function unlinkTx(itemId: string, txId: string) {
    patchItemData(itemId, { txs: itemDataOf(md, itemId).txs.filter((t) => t.id !== txId) });
  }

  const pickerList = useMemo(() => {
    if (!pickerTxs) return null;
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return pickerTxs;
    return pickerTxs.filter((t) => `${t.description ?? ''} ${t.alias ?? ''} ${t.categoryName ?? ''}`.toLowerCase().includes(q));
  }, [pickerTxs, pickerSearch]);

  return (
    <TabScreen>
      <Text style={styles.title}>Distribuição</Text>

      {/* Seletor de mês */}
      <View style={[styles.monthBar, { backgroundColor: colors.brandSurface, borderRadius: radius.md, ...shadows.card }]}>
        <Pressable onPress={() => setMonthOffset((v) => v - 1)} hitSlop={10} style={styles.monthChevron}>
          <Ionicons name="chevron-back" size={20} color={colors.brandTextSecondary} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={() => setMonthOffset((v) => v + 1)} hitSlop={10} style={styles.monthChevron}>
          <Ionicons name="chevron-forward" size={20} color={colors.brandTextSecondary} />
        </Pressable>
      </View>

      {/* Distribuições do mês */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={{ flexGrow: 0, marginBottom: 12 }}>
        {visible.map((d) => {
          const active = selected?.id === d.id;
          return (
            <Pressable
              key={d.id}
              onPress={() => setSelectedId(d.id)}
              style={[styles.chip, { backgroundColor: active ? colors.brandPrimary : colors.brandPillBg, borderColor: active ? colors.brandPrimary : colors.brandDivider }]}
            >
              {d.recurring ? <Ionicons name="repeat" size={12} color={active ? colors.brandTextOnPrimary : colors.brandTextSecondary} /> : null}
              <Text style={[styles.chipText, { color: active ? colors.brandTextOnPrimary : colors.brandTextSecondary }]}>{d.name}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={addDistribution} style={[styles.chipAdd, { borderColor: colors.brandDivider }]}>
          <Ionicons name="add" size={18} color={colors.brandTextSecondary} />
        </Pressable>
      </ScrollView>

      {!selected ? (
        <Text style={styles.emptyHint}>Nenhuma distribuição neste mês. Toque no + pra criar (marque como recorrente pra aparecer todo mês).</Text>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
          >
            {/* Header + base + recorrência */}
            <View style={[styles.card, { ...shadows.card }]}>
              <View style={styles.distHeader}>
                <Pressable onPress={renameSelected} hitSlop={6} style={styles.distNameWrap}>
                  <Text style={styles.distName} numberOfLines={1}>{selected.name}</Text>
                  <Ionicons name="pencil" size={13} color={colors.brandTextSecondary} />
                </Pressable>
                <Pressable onPress={deleteSelected} hitSlop={6}>
                  <Ionicons name="trash-outline" size={18} color={colors.brandError} />
                </Pressable>
              </View>

              <View style={styles.recurRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="repeat" size={15} color={colors.brandTextSecondary} />
                  <Text style={styles.recurLabel}>Recorrente (todo mês)</Text>
                </View>
                <Switch
                  value={selected.recurring}
                  onValueChange={toggleRecurring}
                  trackColor={{ true: colors.brandPrimary, false: colors.brandDivider }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <Text style={styles.cardLabel}>Valor a distribuir · {monthLabel}</Text>
              <View style={styles.baseInputRow}>
                <Text style={styles.currencyPrefix}>R$</Text>
                <TextInput
                  style={styles.baseInput}
                  value={md.base}
                  onChangeText={setBase}
                  placeholder="0,00"
                  placeholderTextColor={colors.brandTextSecondary}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                />
              </View>
            </View>

            {/* Itens */}
            {rows.map((row) => (
              <Animated.View
                key={row.id}
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(140)}
                layout={LinearTransition.duration(200)}
                style={[styles.itemCard, { ...shadows.card }]}
              >
                <View style={styles.itemHeader}>
                  <Pressable onPress={() => patchItemData(row.id, { checked: !row.checked })} hitSlop={8}>
                    <Ionicons name={row.checked ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={row.checked ? colors.brandPrimary : colors.brandTextSecondary} />
                  </Pressable>
                  <TextInput
                    style={[styles.itemLabelInput, row.checked && styles.itemChecked]}
                    value={row.label}
                    onChangeText={(t) => patchItemStruct(row.id, { label: t })}
                    placeholder="Nome (ex.: Renda fixa)"
                    placeholderTextColor={colors.brandTextSecondary}
                  />
                  <Pressable onPress={() => removeItem(row.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={17} color={colors.brandError} />
                  </Pressable>
                </View>

                <View style={styles.itemControls}>
                  <View style={styles.modeToggle}>
                    <ModeBtn label="%" active={row.mode === 'percent'} onPress={() => patchItemStruct(row.id, { mode: 'percent' })} colors={colors} styles={styles} />
                    <ModeBtn label="R$" active={row.mode === 'fixed'} onPress={() => patchItemStruct(row.id, { mode: 'fixed' })} colors={colors} styles={styles} />
                  </View>
                  <View style={styles.valueInputWrap}>
                    <TextInput
                      style={styles.valueInput}
                      value={row.value}
                      onChangeText={(t) => patchItemData(row.id, { value: t })}
                      placeholder={row.mode === 'percent' ? '0' : '0,00'}
                      placeholderTextColor={colors.brandTextSecondary}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                    />
                    <Text style={styles.valueSuffix}>{row.mode === 'percent' ? '%' : 'R$'}</Text>
                  </View>
                </View>

                <Text style={styles.itemComputed}>
                  {row.mode === 'percent' ? `= ${formatCurrency(row.amount)}` : baseNum > 0 ? `= ${row.pct.toFixed(1)}% do total` : 'defina o valor base'}
                </Text>

                {row.txs.map((t) => (
                  <View key={t.id} style={styles.txRow}>
                    <Ionicons name="link" size={13} color={colors.brandTextSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txDesc} numberOfLines={1}>{t.description}</Text>
                      <Text style={styles.txMeta}>{formatDate(t.date)}</Text>
                    </View>
                    <Text style={[styles.txAmount, { color: t.amount < 0 ? colors.brandTextNegative : colors.brandTextPositive }]}>
                      {t.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
                    </Text>
                    <Pressable onPress={() => unlinkTx(row.id, t.id)} hitSlop={8}>
                      <Ionicons name="close" size={14} color={colors.brandTextSecondary} />
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={() => openPicker(row.id)} style={styles.linkBtn}>
                  <Ionicons name="add" size={14} color={colors.brandPrimaryDark} />
                  <Text style={styles.linkBtnText}>Vincular transação</Text>
                </Pressable>
              </Animated.View>
            ))}

            <Pressable onPress={addItem} style={styles.addBtn}>
              <Ionicons name="add-circle-outline" size={20} color={colors.brandPrimaryDark} />
              <Text style={styles.addBtnText}>Adicionar item</Text>
            </Pressable>

            <Animated.View layout={LinearTransition.duration(200)} style={[styles.summaryCard, { ...shadows.card }]}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.min(100, allocatedPct)}%`, backgroundColor: over ? colors.brandError : colors.brandPrimary }]} />
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Distribuído</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalAllocated)} · {allocatedPct.toFixed(0)}%</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{over ? 'Passou do valor' : 'Restante'}</Text>
                <Text style={[styles.summaryValue, { color: over ? colors.brandTextNegative : colors.brandTextPositive }]}>{formatCurrency(Math.abs(remaining))}</Text>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Sheet: escolher transação (com navegação por mês + busca) */}
      {pickerItemId ? (
        <BottomSheet onClose={() => setPickerItemId(null)} maxHeightFraction={0.82} asNativeModal>
          <Text style={styles.sheetTitle}>Vincular transação</Text>
          <View style={styles.sheetMonthBar}>
            <Pressable onPress={() => loadPickerMonth(pickerOffset - 1)} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={colors.brandTextSecondary} />
            </Pressable>
            <Text style={styles.sheetMonthLabel}>{capitalize(format(addMonths(new Date(), pickerOffset), "LLL 'de' yyyy", { locale: ptBR }))}</Text>
            <Pressable onPress={() => loadPickerMonth(pickerOffset + 1)} hitSlop={10}>
              <Ionicons name="chevron-forward" size={20} color={colors.brandTextSecondary} />
            </Pressable>
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={15} color={colors.brandTextSecondary} />
            <TextInput
              style={styles.searchInput}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder="Buscar"
              placeholderTextColor={colors.brandTextSecondary}
            />
          </View>
          {pickerList === null ? (
            <View style={{ paddingVertical: 30, alignItems: 'center' }}><LoadingDog size={40} color={colors.brandPrimaryDark} /></View>
          ) : pickerList.length === 0 ? (
            <Text style={styles.emptyHint}>Nenhuma transação neste mês.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {pickerList.map((t) => (
                <Pressable key={t.id} onPress={() => linkTx(t)} style={({ pressed }) => [styles.pickRow, pressed && { opacity: 0.6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickDesc} numberOfLines={1}>{t.alias || t.description}</Text>
                    <Text style={styles.pickMeta}>{formatDate(t.occurredAt)}{t.categoryName ? ` · ${t.categoryName}` : ''}</Text>
                  </View>
                  <Text style={[styles.pickAmount, { color: t.amount < 0 ? colors.brandTextNegative : colors.brandTextPositive }]}>
                    {t.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </BottomSheet>
      ) : null}
    </TabScreen>
  );
}

function migrateOne(name: string, base: any, items: any[] | undefined, mk: string): Distribution {
  const structItems: Item[] = (items ?? []).map((it) => ({ id: it.id ?? newId(), label: it.label ?? '', mode: it.mode === 'fixed' ? 'fixed' : 'percent' }));
  const monthItems: Record<string, ItemMonthData> = {};
  for (const it of items ?? []) {
    const id = it.id ?? structItems.find((s) => s.label === it.label)?.id;
    if (id) monthItems[id] = { value: it.value ?? '', checked: !!it.checked, txs: Array.isArray(it.txs) ? it.txs : [] };
  }
  return {
    id: newId(),
    name: name || 'Distribuição',
    recurring: false,
    createdMonth: mk,
    items: structItems,
    data: { [mk]: { base: typeof base === 'string' ? base : '', items: monthItems } },
  };
}

function emptyDist(name: string, mk: string, recurring: boolean): Distribution {
  return { id: newId(), name, recurring, createdMonth: mk, items: [], data: {} };
}

function ModeBtn({ label, active, onPress, colors, styles }: { label: string; active: boolean; onPress: () => void; colors: any; styles: any }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeBtn, { backgroundColor: active ? colors.brandPrimary : 'transparent' }]}>
      <Text style={[styles.modeBtnText, { color: active ? colors.brandTextOnPrimary : colors.brandTextSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    title: { fontSize: 24, fontWeight: '800', color: c.brandTextPrimary, marginBottom: 12 },
    monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 10, marginBottom: 12 },
    monthChevron: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    monthLabel: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '800', color: c.brandTextPrimary },
    chipsRow: { gap: 8, alignItems: 'center', paddingRight: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
    chipText: { fontSize: 13, fontWeight: '800' },
    chipAdd: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    card: { backgroundColor: c.brandSurface, borderRadius: 16, padding: 16, marginBottom: 12 },
    distHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    distNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    distName: { fontSize: 17, fontWeight: '800', color: c.brandTextPrimary },
    recurRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.brandDivider, marginBottom: 12 },
    recurLabel: { fontSize: 14, fontWeight: '700', color: c.brandTextPrimary },
    cardLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: c.brandTextSecondary },
    baseInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    currencyPrefix: { fontSize: 26, fontWeight: '900', color: c.brandTextSecondary },
    baseInput: { flex: 1, fontSize: 30, fontWeight: '900', color: c.brandTextPrimary, paddingVertical: 2 },
    itemCard: { backgroundColor: c.brandSurface, borderRadius: 16, padding: 14, marginBottom: 10 },
    itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    itemLabelInput: { flex: 1, fontSize: 15, fontWeight: '700', color: c.brandTextPrimary, paddingVertical: 4 },
    itemChecked: { textDecorationLine: 'line-through', color: c.brandTextSecondary },
    itemControls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
    modeToggle: { flexDirection: 'row', backgroundColor: c.brandPillBg, borderRadius: 10, padding: 3, gap: 2 },
    modeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, minWidth: 40, alignItems: 'center' },
    modeBtnText: { fontSize: 14, fontWeight: '800' },
    valueInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: c.brandSurfaceAlt, borderWidth: 1, borderColor: c.brandDivider, borderRadius: 10, paddingHorizontal: 12 },
    valueInput: { flex: 1, fontSize: 16, fontWeight: '700', color: c.brandTextPrimary, paddingVertical: 10 },
    valueSuffix: { fontSize: 13, fontWeight: '800', color: c.brandTextSecondary, marginLeft: 6 },
    itemComputed: { fontSize: 13, fontWeight: '700', color: c.brandPrimaryDark, marginTop: 8 },
    txRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.brandDivider },
    txDesc: { fontSize: 13, fontWeight: '600', color: c.brandTextPrimary },
    txMeta: { fontSize: 11, color: c.brandTextSecondary, marginTop: 1 },
    txAmount: { fontSize: 13, fontWeight: '800' },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start' },
    linkBtnText: { fontSize: 13, fontWeight: '700', color: c.brandPrimaryDark },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.brandPrimary, marginBottom: 12 },
    addBtnText: { fontSize: 15, fontWeight: '800', color: c.brandPrimaryDark },
    summaryCard: { backgroundColor: c.brandSurface, borderRadius: 16, padding: 16, marginBottom: 12 },
    barTrack: { height: 10, borderRadius: 999, backgroundColor: c.brandPillBg, overflow: 'hidden', marginBottom: 14 },
    barFill: { height: 10, borderRadius: 999 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    summaryLabel: { fontSize: 14, fontWeight: '700', color: c.brandTextSecondary },
    summaryValue: { fontSize: 15, fontWeight: '800', color: c.brandTextPrimary },
    emptyHint: { fontSize: 13, color: c.brandTextSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20, marginTop: 8 },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: c.brandTextPrimary, marginBottom: 10 },
    sheetMonthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    sheetMonthLabel: { fontSize: 14, fontWeight: '800', color: c.brandTextPrimary },
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.brandSurfaceAlt, borderWidth: 1, borderColor: c.brandDivider, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
    searchInput: { flex: 1, fontSize: 14, color: c.brandTextPrimary, paddingVertical: 2 },
    pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.brandDivider },
    pickDesc: { fontSize: 14, fontWeight: '700', color: c.brandTextPrimary },
    pickMeta: { fontSize: 12, color: c.brandTextSecondary, marginTop: 2 },
    pickAmount: { fontSize: 14, fontWeight: '800' },
  });
}
