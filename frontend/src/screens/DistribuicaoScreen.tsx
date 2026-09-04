import { useEffect, useMemo, useRef, useState } from 'react';
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
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addMonths, differenceInCalendarMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { transactionsService } from '@/services/transactions.service';
import { analyticsService, type Installment, type Subscription } from '@/services/analytics.service';
import { TabScreen } from '@/ui/TabScreen';
import { BottomSheet } from '@/ui/BottomSheet';
import { MonthPickerSheet } from '@/ui/MonthPickerSheet';
import type { Transaction } from '@/types/api.types';

type Mode = 'percent' | 'fixed';
type Section = 'assinatura' | 'parcelamento';
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
  dismissed?: string[]; // autoKeys de assinaturas/parcelas ocultadas pelo usuário
};

// Linha renderizada: item manual (auto=false) ou item automático de salário
// (assinatura/parcelamento). Auto items são calculados ao vivo por mês; seu
// estado editável (override de valor, check, txs) vive em md.items[autoKey].
type Row = {
  id: string;
  label: string;
  mode: Mode;
  auto: boolean;
  section: Section | null;
  autoKey: string | null;
  sublabel: string | null;
  value: string;
  checked: boolean;
  txs: LinkedTx[];
  amount: number;
  manualAmount: number;
  linkedSum: number;
  hasLinks: boolean;
  computedValue: number;
  pct: number;
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

// Normaliza nome (sem acento, minúsculo, sem espaços nas pontas).
function normName(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
// A pill "salário" (chave mágica): qualquer nome que normalizado começa com "salari".
function isSalaryName(name: string): boolean {
  return normName(name).startsWith('salari');
}

function formatValueInput(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
}

// Soma a cobrança REAL de uma assinatura num conjunto de transações do mês
// (pega o mês que veio diferente, ex.: Total Pass valor normal + 30 adicional).
function sumSubCharge(txs: Transaction[], s: Subscription): number {
  const merch = normName(s.merchantName || '');
  const keyTok = normName(s.key || '');
  let sum = 0;
  for (const t of txs) {
    if (t.amount >= 0) continue; // só despesa
    const tm = normName(t.merchantName || '');
    const td = normName(t.description || '');
    const match = merch ? tm === merch : keyTok.length >= 3 && (td.includes(keyTok) || tm.includes(keyTok));
    if (match) sum += Math.abs(t.amount);
  }
  return Math.round(sum * 100) / 100;
}

// Monta um Row automático, mesclando o valor computado do mês com o estado
// editável salvo (override de valor / check / txs vinculadas).
function buildAutoRow(autoKey: string, label: string, section: Section, sublabel: string, computedValue: number, md: MonthData, baseNum: number): Row {
  const d = md.items[autoKey];
  const overrideStr = d && typeof d.value === 'string' && d.value !== '' ? d.value : '';
  const txs = d?.txs ?? [];
  const checked = d?.checked ?? false;
  const linkedSum = txs.reduce((s, t) => s + Math.abs(t.amount), 0);
  const hasLinks = txs.length > 0;
  const amount = hasLinks ? linkedSum : overrideStr ? toNum(overrideStr) : computedValue;
  const pct = baseNum > 0 ? (amount / baseNum) * 100 : 0;
  return {
    id: autoKey,
    label,
    mode: 'fixed',
    auto: true,
    section,
    autoKey,
    sublabel,
    value: overrideStr || formatValueInput(computedValue),
    checked,
    txs,
    amount,
    manualAmount: computedValue,
    linkedSum,
    hasLinks,
    computedValue,
    pct,
  };
}

export default function DistribuicaoScreen() {
  const { colors, radius, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: screenW } = useWindowDimensions();

  const [dists, setDists] = useState<Distribution[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  // Seções colapsadas (Assinaturas / Parcelamentos / Meus itens) — persistido.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  const [loaded, setLoaded] = useState(false);

  // Picker
  const [pickerItemId, setPickerItemId] = useState<string | null>(null);
  const [pickerOffset, setPickerOffset] = useState(0);
  const [pickerTxs, setPickerTxs] = useState<Transaction[] | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Dados de salário (assinaturas + parcelamentos + transações do mês p/ cobrança real)
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [installments, setInstallments] = useState<Installment[] | null>(null);
  const [salaryTxsByMonth, setSalaryTxsByMonth] = useState<Record<string, Transaction[]>>({});

  const monthDate = useMemo(() => addMonths(new Date(), monthOffset), [monthOffset]);
  const monthKey = useMemo(() => format(monthDate, 'yyyy-MM'), [monthDate]);
  const monthLabel = useMemo(() => capitalize(format(monthDate, "LLLL 'de' yyyy", { locale: ptBR })), [monthDate]);

  // Slide direcional ao trocar de mês (mesma dinâmica de Transações).
  const translateX = useSharedValue(0);
  const prevOffsetRef = useRef(monthOffset);
  useEffect(() => {
    if (prevOffsetRef.current === monthOffset) return;
    const direction = monthOffset < prevOffsetRef.current ? -1 : 1;
    translateX.value = direction * screenW * 0.18;
    translateX.value = withSpring(0, { damping: 26, stiffness: 320, mass: 0.6 });
    prevOffsetRef.current = monthOffset;
  }, [monthOffset, screenW, translateX]);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  // Slide direcional ao trocar de mês DENTRO do picker de vincular transação.
  const pickerTranslateX = useSharedValue(0);
  const prevPickerOffsetRef = useRef(pickerOffset);
  useEffect(() => {
    if (prevPickerOffsetRef.current === pickerOffset) return;
    const direction = pickerOffset < prevPickerOffsetRef.current ? -1 : 1;
    pickerTranslateX.value = direction * screenW * 0.22;
    pickerTranslateX.value = withSpring(0, { damping: 24, stiffness: 300, mass: 0.6 });
    prevPickerOffsetRef.current = pickerOffset;
  }, [pickerOffset, screenW, pickerTranslateX]);
  const pickerSlideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pickerTranslateX.value }] }));

  // Pulse do skeleton (loading das transações do picker).
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { dists?: Distribution[]; selectedId?: string; collapsed?: Record<string, boolean> };
          if (Array.isArray(parsed.dists)) {
            setDists(parsed.dists);
            setSelectedId(parsed.selectedId ?? parsed.dists[0]?.id ?? null);
            if (parsed.collapsed) setCollapsed(parsed.collapsed);
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ dists, selectedId, collapsed })).catch(() => undefined);
  }, [dists, selectedId, collapsed, loaded]);

  // Distribuições visíveis no mês: recorrentes sempre; não-recorrentes só no mês criado.
  const visible = useMemo(
    () => dists.filter((d) => d.recurring || d.createdMonth === monthKey),
    [dists, monthKey]
  );
  const selected = visible.find((d) => d.id === selectedId) ?? visible[0] ?? null;
  const md = selected ? monthDataOf(selected, monthKey) : EMPTY_MD;
  const baseNum = toNum(md.base);
  const isSalary = !!selected && isSalaryName(selected.name);
  const anySalary = useMemo(() => dists.some((d) => isSalaryName(d.name)), [dists]);

  // Carrega assinaturas + parcelamentos uma vez (só se há pill de salário).
  useEffect(() => {
    if (!anySalary || subs !== null) return; // já buscou ou não precisa
    let alive = true;
    analyticsService.subscriptions().then((r) => { if (alive) setSubs(r.items); }).catch(() => { if (alive) setSubs([]); });
    analyticsService.installments().then((r) => { if (alive) setInstallments(r.items); }).catch(() => { if (alive) setInstallments([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anySalary]);

  // Transações do mês visível (só quando a pill é de salário) p/ achar a cobrança
  // REAL de cada assinatura naquele mês. Cacheia por mês.
  useEffect(() => {
    if (!isSalary || salaryTxsByMonth[monthKey]) return;
    let alive = true;
    const d = monthDate;
    transactionsService
      .list({ startDate: format(startOfMonth(d), 'yyyy-MM-dd'), endDate: format(endOfMonth(d), 'yyyy-MM-dd'), limit: 100 })
      .then((r) => { if (alive) setSalaryTxsByMonth((c) => ({ ...c, [monthKey]: (((r as any).items ?? []) as Transaction[]) })); })
      .catch(() => { if (alive) setSalaryTxsByMonth((c) => ({ ...c, [monthKey]: [] })); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSalary, monthKey]);

  // Itens automáticos do salário (assinaturas + parcelas do mês), calculados ao vivo.
  const autoRows = useMemo<Row[]>(() => {
    if (!selected || !isSalary) return [];
    const monthTxs = salaryTxsByMonth[monthKey];
    const dismissed = new Set(selected.dismissed ?? []);
    const out: Row[] = [];
    for (const s of subs ?? []) {
      const autoKey = `sub:${s.key}`;
      if (dismissed.has(autoKey)) continue;
      const real = monthTxs ? sumSubCharge(monthTxs, s) : 0;
      const value = real > 0.005 ? real : s.monthlyAmount;
      const sub = real > 0.005 ? 'cobrança do mês' : 'valor típico';
      out.push(buildAutoRow(autoKey, s.label, 'assinatura', sub, value, md, baseNum));
    }
    for (const it of installments ?? []) {
      const first = startOfMonth(new Date(it.occurredAt));
      const n = differenceInCalendarMonths(startOfMonth(monthDate), first) + 1;
      if (n < 1 || n > it.installmentTotal) continue; // parcela não cai neste mês
      const autoKey = `inst:${normName(it.alias || it.description)}|${it.installmentTotal}`;
      if (dismissed.has(autoKey)) continue;
      out.push(buildAutoRow(autoKey, it.alias || it.description, 'parcelamento', `Parcela ${n}/${it.installmentTotal}`, it.installmentAmount, md, baseNum));
    }
    return out;
  }, [selected, isSalary, subs, installments, salaryTxsByMonth, monthKey, monthDate, md, baseNum]);

  const manualRows = useMemo<Row[]>(() => {
    if (!selected) return [];
    return selected.items.map((it) => {
      const d = itemDataOf(md, it.id);
      const v = toNum(d.value);
      const manualAmount = it.mode === 'percent' ? (baseNum * v) / 100 : v;
      const linkedSum = d.txs.reduce((s, t) => s + Math.abs(t.amount), 0);
      const hasLinks = d.txs.length > 0;
      // Com transações vinculadas, o valor do item passa a ser a SOMA delas
      // (o comprovante real sobrepõe o valor planejado manualmente).
      const amount = hasLinks ? linkedSum : manualAmount;
      const pct = baseNum > 0 ? (amount / baseNum) * 100 : 0;
      return {
        id: it.id, label: it.label, mode: it.mode, auto: false, section: null, autoKey: null, sublabel: null,
        value: d.value, checked: d.checked, txs: d.txs, amount, manualAmount, linkedSum, hasLinks, computedValue: manualAmount, pct,
      } as Row;
    });
  }, [selected, md, baseNum]);

  const assinaturaRows = useMemo(() => autoRows.filter((r) => r.section === 'assinatura'), [autoRows]);
  const parcelaRows = useMemo(() => autoRows.filter((r) => r.section === 'parcelamento'), [autoRows]);
  const rows = useMemo(() => [...autoRows, ...manualRows], [autoRows, manualRows]);
  // Loading estrutural (assinaturas + parcelas). As txs do mês refinam o valor
  // de cada assinatura em silêncio depois (típico → cobrança real do mês).
  const salaryLoading = isSalary && (subs === null || installments === null);
  const dismissedCount = selected?.dismissed?.length ?? 0;

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
  // Oculta um item automático (assinatura/parcela) deste distribuição — não reaparece.
  function dismissAuto(autoKey: string) {
    if (!selected) return;
    patchDist(selected.id, (d) => ({ ...d, dismissed: [...(d.dismissed ?? []).filter((k) => k !== autoKey), autoKey] }));
  }
  function restoreDismissed() {
    if (!selected) return;
    patchDist(selected.id, (d) => ({ ...d, dismissed: [] }));
  }
  function removeRow(row: Row) {
    if (row.auto && row.autoKey) dismissAuto(row.autoKey);
    else removeItem(row.id);
  }
  function toggleRecurring() {
    if (!selected) return;
    patchDist(selected.id, (d) => ({ ...d, recurring: !d.recurring }));
  }
  // Reordena as pills: troca a distribuição com a vizinha visível (mantém as de
  // outros meses no lugar; só muda a ordem relativa das que aparecem no mês).
  function moveVisible(id: string, dir: -1 | 1) {
    const order = visible.map((v) => v.id);
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const neighborId = order[j];
    setDists((prev) => {
      const a = prev.findIndex((d) => d.id === id);
      const b = prev.findIndex((d) => d.id === neighborId);
      if (a < 0 || b < 0) return prev;
      const copy = [...prev];
      [copy[a], copy[b]] = [copy[b], copy[a]];
      return copy;
    });
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
        limit: 100, // a rota /transactions trava em 100; acima disso volta 400 (lista vazia)
      });
      setPickerTxs(((res as any).items ?? []) as Transaction[]);
    } catch {
      setPickerTxs([]);
    }
  }
  function openPicker(itemId: string) {
    setPickerItemId(itemId);
    setPickerSearch('');
    prevPickerOffsetRef.current = monthOffset; // evita slide na abertura
    loadPickerMonth(monthOffset);
  }
  function linkTx(tx: Transaction) {
    if (!pickerItemId) return;
    const link: LinkedTx = { id: tx.id, description: tx.alias || tx.description || 'Transação', amount: tx.amount, date: tx.occurredAt };
    // Vinculou comprovante → marca o item como concluído automaticamente.
    patchItemData(pickerItemId, { txs: [...itemDataOf(md, pickerItemId).txs.filter((t) => t.id !== link.id), link], checked: true });
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

  const renderRow = (row: Row) => (
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
        {row.auto ? (
          <View style={styles.autoLabelWrap}>
            <Text style={[styles.autoLabelText, row.checked && styles.itemChecked]} numberOfLines={1}>{row.label}</Text>
            {row.sublabel ? <Text style={styles.autoSublabel}>{row.sublabel}</Text> : null}
          </View>
        ) : (
          <TextInput
            style={[styles.itemLabelInput, row.checked && styles.itemChecked]}
            value={row.label}
            onChangeText={(t) => patchItemStruct(row.id, { label: t })}
            placeholder="Nome (ex.: Renda fixa)"
            placeholderTextColor={colors.brandTextSecondary}
          />
        )}
        <Pressable onPress={() => removeRow(row)} hitSlop={8}>
          <Ionicons name={row.auto ? 'eye-off-outline' : 'trash-outline'} size={row.auto ? 18 : 17} color={colors.brandError} />
        </Pressable>
      </View>

      <View style={styles.itemControls}>
        {row.auto ? (
          <View style={[styles.sectionChip, { backgroundColor: colors.brandPillBg }]}>
            <Ionicons name={row.section === 'assinatura' ? 'repeat' : 'card-outline'} size={13} color={colors.brandTextSecondary} />
            <Text style={styles.sectionChipText}>{row.section === 'assinatura' ? 'Assinatura' : 'Parcela'}</Text>
          </View>
        ) : (
          <View style={styles.modeToggle}>
            <ModeBtn label="%" active={row.mode === 'percent'} onPress={() => patchItemStruct(row.id, { mode: 'percent' })} colors={colors} styles={styles} />
            <ModeBtn label="R$" active={row.mode === 'fixed'} onPress={() => patchItemStruct(row.id, { mode: 'fixed' })} colors={colors} styles={styles} />
          </View>
        )}
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

      {row.hasLinks ? (
        <Text style={styles.itemComputed}>
          = {formatCurrency(row.linkedSum)} · {row.txs.length} vinculada{row.txs.length > 1 ? 's' : ''}
          {row.computedValue > 0 ? `  ·  ${row.auto ? 'auto' : 'meta'} ${formatCurrency(row.computedValue)}` : ''}
        </Text>
      ) : row.auto ? (
        <Text style={styles.itemComputed}>
          = {formatCurrency(row.amount)}
          {Math.abs(row.amount - row.computedValue) > 0.005 ? `  ·  auto ${formatCurrency(row.computedValue)}` : ''}
        </Text>
      ) : (
        <Text style={styles.itemComputed}>
          {row.mode === 'percent' ? `= ${formatCurrency(row.amount)}` : baseNum > 0 ? `= ${row.pct.toFixed(1)}% do total` : 'defina o valor base'}
        </Text>
      )}

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
  );

  return (
    <TabScreen>
      <Text style={styles.title}>Distribuição</Text>

      {/* Seletor de mês */}
      <View style={[styles.monthBar, { backgroundColor: colors.brandSurface, borderRadius: radius.md, ...shadows.card }]}>
        <Pressable onPress={() => setMonthOffset((v) => v - 1)} hitSlop={10} style={styles.monthChevron}>
          <Ionicons name="chevron-back" size={20} color={colors.brandTextSecondary} />
        </Pressable>
        <Pressable onPress={() => setMonthPickerOpen(true)} style={styles.monthLabelBtn} hitSlop={8}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Ionicons name="chevron-down" size={15} color={colors.brandTextSecondary} />
        </Pressable>
        <Pressable onPress={() => setMonthOffset((v) => v + 1)} hitSlop={10} style={styles.monthChevron}>
          <Ionicons name="chevron-forward" size={20} color={colors.brandTextSecondary} />
        </Pressable>
      </View>

      <Animated.View style={[styles.slideArea, slideStyle]}>
      {/* Distribuições do mês */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={{ flexGrow: 0, marginBottom: 12 }}>
        {visible.map((d) => (
          <DistPill
            key={d.id}
            name={d.name}
            recurring={d.recurring}
            active={selected?.id === d.id}
            onPress={() => setSelectedId(d.id)}
            onLongPress={() => { if (visible.length > 1) setReorderOpen(true); }}
            colors={colors}
            styles={styles}
          />
        ))}
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

              {/* Relação distribuído / restante — logo após o valor a distribuir */}
              <View style={styles.relWrap}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(100, allocatedPct)}%`, backgroundColor: over ? colors.brandError : colors.brandPrimary }]} />
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Já distribuído</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(totalAllocated)} · {allocatedPct.toFixed(0)}%</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{over ? 'Passou do valor' : 'Ainda resta'}</Text>
                  <Text style={[styles.summaryValue, { color: over ? colors.brandTextNegative : colors.brandTextPositive }]}>{formatCurrency(Math.abs(remaining))}</Text>
                </View>
              </View>
            </View>

            {/* Carregando assinaturas/parcelas do salário */}
            {salaryLoading ? (
              <Animated.View style={pulseStyle}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <View key={i} style={[styles.itemCard, { ...shadows.card }]}>
                    <View style={[styles.skelLine, { width: '55%', backgroundColor: colors.brandDivider }]} />
                    <View style={[styles.skelLine, { width: '32%', height: 22, marginTop: 14, backgroundColor: colors.brandDivider }]} />
                  </View>
                ))}
              </Animated.View>
            ) : null}

            {/* Assinaturas (auto) */}
            {isSalary && assinaturaRows.length > 0 ? (
              <SectionHeaderRow icon="repeat" title="Assinaturas" count={assinaturaRows.length} sum={assinaturaRows.reduce((s, r) => s + r.amount, 0)} collapsed={!!collapsed.assinatura} onToggle={() => toggleSection('assinatura')} colors={colors} styles={styles} />
            ) : null}
            {!collapsed.assinatura && assinaturaRows.map(renderRow)}

            {/* Parcelamentos (auto, só os que caem no mês) */}
            {isSalary && parcelaRows.length > 0 ? (
              <SectionHeaderRow icon="card-outline" title="Parcelamentos" count={parcelaRows.length} sum={parcelaRows.reduce((s, r) => s + r.amount, 0)} collapsed={!!collapsed.parcelamento} onToggle={() => toggleSection('parcelamento')} colors={colors} styles={styles} />
            ) : null}
            {!collapsed.parcelamento && parcelaRows.map(renderRow)}

            {/* Meus itens (manuais) — só ganha cabeçalho quando há auto acima */}
            {isSalary && autoRows.length > 0 ? (
              <SectionHeaderRow icon="pricetags-outline" title="Meus itens" count={manualRows.length} sum={manualRows.reduce((s, r) => s + r.amount, 0)} collapsed={!!collapsed.meus} onToggle={() => toggleSection('meus')} colors={colors} styles={styles} />
            ) : null}
            {!(isSalary && autoRows.length > 0 && collapsed.meus) && manualRows.map(renderRow)}

            <Pressable onPress={addItem} style={styles.addBtn}>
              <Ionicons name="add-circle-outline" size={20} color={colors.brandPrimaryDark} />
              <Text style={styles.addBtnText}>Adicionar item</Text>
            </Pressable>

            {isSalary && dismissedCount > 0 ? (
              <Pressable onPress={restoreDismissed} style={styles.restoreBtn}>
                <Ionicons name="eye-outline" size={16} color={colors.brandTextSecondary} />
                <Text style={styles.restoreText}>Mostrar {dismissedCount} oculto{dismissedCount > 1 ? 's' : ''}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      </Animated.View>

      <MonthPickerSheet
        visible={monthPickerOpen}
        selected={monthDate}
        onClose={() => setMonthPickerOpen(false)}
        onSelect={(m) => setMonthOffset(differenceInCalendarMonths(startOfMonth(m), startOfMonth(new Date())))}
      />

      {/* Sheet: reordenar distribuições (abre no long-press da pill) */}
      {reorderOpen ? (
        <BottomSheet onClose={() => setReorderOpen(false)} maxHeightFraction={0.7} asNativeModal>
          <Text style={styles.sheetTitle}>Reordenar distribuições</Text>
          <Text style={styles.reorderHint}>Use as setas pra mudar a ordem das pills no mês.</Text>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {visible.map((d, i) => (
              <Animated.View key={d.id} layout={LinearTransition.duration(220)} style={styles.reorderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  {d.recurring ? <Ionicons name="repeat" size={14} color={colors.brandTextSecondary} /> : null}
                  <Text style={styles.reorderName} numberOfLines={1}>{d.name}</Text>
                </View>
                <Pressable disabled={i === 0} onPress={() => moveVisible(d.id, -1)} style={styles.reorderBtn} hitSlop={6}>
                  <Ionicons name="chevron-up" size={22} color={i === 0 ? colors.brandDivider : colors.brandTextPrimary} />
                </Pressable>
                <Pressable disabled={i === visible.length - 1} onPress={() => moveVisible(d.id, 1)} style={styles.reorderBtn} hitSlop={6}>
                  <Ionicons name="chevron-down" size={22} color={i === visible.length - 1 ? colors.brandDivider : colors.brandTextPrimary} />
                </Pressable>
              </Animated.View>
            ))}
          </ScrollView>
        </BottomSheet>
      ) : null}

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
          <Animated.View style={[styles.pickerBody, pickerSlideStyle]}>
            {pickerList === null ? (
              <Animated.View style={pulseStyle}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <View key={i} style={styles.pickRow}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={[styles.skelLine, { width: `${68 - (i % 3) * 9}%`, backgroundColor: colors.brandDivider }]} />
                      <View style={[styles.skelLine, { width: '38%', height: 10, backgroundColor: colors.brandDivider }]} />
                    </View>
                    <View style={[styles.skelLine, { width: 62, backgroundColor: colors.brandDivider }]} />
                  </View>
                ))}
              </Animated.View>
            ) : pickerList.length === 0 ? (
              <Text style={styles.emptyHint}>Nenhuma transação neste mês.</Text>
            ) : (
              <Animated.View key={pickerOffset} entering={FadeIn.duration(200)}>
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
              </Animated.View>
            )}
          </Animated.View>
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

function DistPill({ name, recurring, active, onPress, onLongPress, colors, styles }: { name: string; recurring: boolean; active: boolean; onPress: () => void; onLongPress: () => void; colors: any; styles: any }) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View layout={LinearTransition.duration(220)} style={aStyle}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={300}
        onPressIn={() => { scale.value = withSpring(0.92, { damping: 18, stiffness: 380 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 320 }); }}
        style={[styles.chip, { backgroundColor: active ? colors.brandPrimary : colors.brandPillBg, borderColor: active ? colors.brandPrimary : colors.brandDivider }]}
      >
        {recurring ? <Ionicons name="repeat" size={12} color={active ? colors.brandTextOnPrimary : colors.brandTextSecondary} /> : null}
        <Text style={[styles.chipText, { color: active ? colors.brandTextOnPrimary : colors.brandTextSecondary }]}>{name}</Text>
      </Pressable>
    </Animated.View>
  );
}

function ModeBtn({ label, active, onPress, colors, styles }: { label: string; active: boolean; onPress: () => void; colors: any; styles: any }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeBtn, { backgroundColor: active ? colors.brandPrimary : 'transparent' }]}>
      <Text style={[styles.modeBtnText, { color: active ? colors.brandTextOnPrimary : colors.brandTextSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function SectionHeaderRow({ icon, title, sum, count, collapsed, onToggle, colors, styles }: { icon: any; title: string; sum: number; count?: number; collapsed?: boolean; onToggle?: () => void; colors: any; styles: any }) {
  return (
    <Pressable onPress={onToggle} hitSlop={6} style={({ pressed }) => [styles.sectionHeaderRow, pressed && { opacity: 0.6 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={collapsed ? 'chevron-forward' : 'chevron-down'} size={15} color={colors.brandTextSecondary} />
        <Ionicons name={icon} size={14} color={colors.brandTextSecondary} />
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
        {collapsed && count != null ? <Text style={styles.sectionHeaderCount}>· {count}</Text> : null}
      </View>
      <Text style={styles.sectionHeaderSum}>{formatCurrency(sum)}</Text>
    </Pressable>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    title: { fontSize: 24, fontWeight: '800', color: c.brandTextPrimary, marginBottom: 12 },
    monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 10, marginBottom: 12 },
    monthChevron: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    monthLabelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    monthLabel: { textAlign: 'center', fontSize: 14, fontWeight: '800', color: c.brandTextPrimary },
    slideArea: { flex: 1 },
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
    relWrap: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.brandDivider },
    reorderHint: { fontSize: 12, color: c.brandTextSecondary, marginBottom: 12 },
    reorderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.brandDivider },
    reorderName: { fontSize: 15, fontWeight: '700', color: c.brandTextPrimary, flexShrink: 1 },
    reorderBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    itemCard: { backgroundColor: c.brandSurface, borderRadius: 16, padding: 14, marginBottom: 10 },
    itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    itemLabelInput: { flex: 1, fontSize: 15, fontWeight: '700', color: c.brandTextPrimary, paddingVertical: 4 },
    itemChecked: { textDecorationLine: 'line-through', color: c.brandTextSecondary },
    autoLabelWrap: { flex: 1 },
    autoLabelText: { fontSize: 15, fontWeight: '700', color: c.brandTextPrimary },
    autoSublabel: { fontSize: 11, fontWeight: '600', color: c.brandTextSecondary, marginTop: 2 },
    sectionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    sectionChipText: { fontSize: 13, fontWeight: '800', color: c.brandTextSecondary },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 8, paddingHorizontal: 2 },
    sectionHeaderTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: c.brandTextSecondary },
    sectionHeaderCount: { fontSize: 12, fontWeight: '700', color: c.brandTextSecondary },
    sectionHeaderSum: { fontSize: 13, fontWeight: '800', color: c.brandTextPrimary },
    restoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginBottom: 12 },
    restoreText: { fontSize: 13, fontWeight: '700', color: c.brandTextSecondary },
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
    pickerBody: { minHeight: 340 },
    skelLine: { height: 13, borderRadius: 5 },
  });
}
