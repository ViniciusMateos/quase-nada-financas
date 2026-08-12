import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useDataRefresh } from '@/contexts/DataRefreshContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAccounts } from '@/hooks/useAccounts';
import { useDashboard } from '@/hooks/useDashboard';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';
import { detectBankKey, effectiveLogoUrl, effectivePrimaryColor } from '@/lib/bankAccountLabel';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { normalizeError } from '@/lib/errorMap';
import { accountsService } from '@/services/accounts.service';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { BankBadge } from '@/ui/BankBadge';
import { ErrorState, ListSkeleton } from '@/ui/States';
import { TransactionCard } from '@/ui/Cards';
import { TabScreen, TabScreenScroll } from '@/ui/TabScreen';

function shortSubtype(subtype?: string | null): string | null {
  switch (subtype) {
    case 'CHECKING_ACCOUNT': return 'Corrente';
    case 'SAVINGS_ACCOUNT': return 'Poupança';
    case 'PREPAID_ACCOUNT': return 'Pré-paga';
    case 'PAYMENT_ACCOUNT': return 'Pagamento';
    default: return null;
  }
}

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors, radius, shadows } = useTheme();
  const { data, loading, refreshing, error, refresh, retry } = useDashboard();
  const { data: portfolio } = usePortfolio();
  const { items: accounts, load: reloadAccounts } = useAccounts();

  const topMovers = useMemo(() => {
    const items = (portfolio?.groups ?? []).flatMap((g) => g.items);
    return items
      .filter((i) => i.profitPct != null)
      .sort((a, b) => (b.profitPct as number) - (a.profitPct as number))
      .slice(0, 3);
  }, [portfolio]);

  const bumpRefresh = useDataRefresh();

  useFocusRefresh(async () => {
    await Promise.all([refresh(), reloadAccounts()]);
  });

  const showStatementInfo = () =>
    Alert.alert(
      'Faturas do cartão',
      'A pagar: a fatura que já fechou (valor oficial do banco), que vence na data indicada — é o boleto.\n\nAberta: o que você está acumulando no ciclo atual (desde o fechamento). Inclui as parcelas já comprometidas pra essa fatura e vai crescendo até fechar.\n\nSe o valor "a pagar" estiver diferente do app do banco, é porque o Open Finance ainda não publicou a fatura nova (leva ~1 dia após o fechamento) — reconectar o cartão em Contas atualiza.',
      [{ text: 'Entendi' }]
    );

  const handleEditCloseDay = (bankAccountId: string, current: number | null | undefined) => {
    Alert.prompt(
      'Dia de fechamento da fatura',
      'Em qual dia do mês essa fatura fecha? (1 a 31)',
      [
        { text: 'Cancelar', style: 'cancel' },
        ...(current
          ? [{
              text: 'Remover',
              style: 'destructive' as const,
              onPress: async () => {
                try {
                  await accountsService.setCreditCloseDay(bankAccountId, null);
                  bumpRefresh();
                } catch (err) {
                  Alert.alert('Erro', normalizeError(err).message);
                }
              },
            }]
          : []),
        {
          text: 'Salvar',
          onPress: async (text?: string) => {
            const n = parseInt((text ?? '').trim(), 10);
            if (!Number.isInteger(n) || n < 1 || n > 31) {
              Alert.alert('Inválido', 'Informe um número entre 1 e 31.');
              return;
            }
            try {
              await accountsService.setCreditCloseDay(bankAccountId, n);
              bumpRefresh();
            } catch (err) {
              Alert.alert('Erro', normalizeError(err).message);
            }
          },
        },
      ],
      'plain-text',
      current ? String(current) : '',
      'number-pad',
    );
  };

  const { bankCards, creditCards, totalChecking, totalCredit } = useMemo(() => {
    type MiniCard = {
      id: string;
      bankName: string;
      balance: number;
      logoUrl?: string | null;
      primaryColor?: string | null;
      isBrand?: boolean;
    };
    type CreditCard = {
      id: string;
      bankName: string;
      logoUrl?: string | null;
      primaryColor?: string | null;
      isBrand?: boolean;
      closedAmount: number; // fatura a pagar (fechada)
      openAmount: number;   // fatura aberta (acumulando)
      dueDate: string | null;
      creditCloseDay?: number | null;
    };
    const bank: MiniCard[] = [];
    const credit: CreditCard[] = [];
    let totBank = 0;
    let totCredit = 0;
    const bankEntries: { card: MiniCard; subtype?: string | null; institution: string }[] = [];
    for (const acc of accounts ?? []) {
      if (acc.isInvestment) continue; // corretora não entra no saldo/cards do banco
      const displayName = acc.customName || acc.bankName;
      const logo = effectiveLogoUrl(acc);
      const tint = effectivePrimaryColor(acc);
      const isBrand = !!(detectBankKey(acc.customName) ?? detectBankKey(acc.bankName));
      for (const ba of acc.bankAccounts ?? []) {
        if (ba.type === 'CREDIT') {
          const closed = ba.currentStatementAmount ?? ba.balance;
          credit.push({
            id: ba.id,
            bankName: displayName,
            logoUrl: logo,
            primaryColor: tint,
            isBrand,
            closedAmount: closed,
            openAmount: ba.statementOpenAmount ?? 0,
            dueDate: ba.statementDueDate ?? null,
            creditCloseDay: ba.creditCloseDay ?? null,
          });
          totCredit += closed;
        } else {
          bankEntries.push({
            card: { id: ba.id, bankName: displayName, balance: ba.balance, logoUrl: logo, primaryColor: tint, isBrand },
            subtype: ba.subtype ?? null,
            institution: displayName,
          });
          totBank += ba.balance;
        }
      }
    }
    // Múltiplas BANK accounts da mesma instituição → adiciona subtipo curto.
    const bankCountByInst = new Map<string, number>();
    for (const e of bankEntries) bankCountByInst.set(e.institution, (bankCountByInst.get(e.institution) ?? 0) + 1);
    for (const e of bankEntries) {
      if ((bankCountByInst.get(e.institution) ?? 0) > 1) {
        const sub = shortSubtype(e.subtype);
        if (sub) e.card.bankName = `${e.institution} · ${sub}`;
      }
      bank.push(e.card);
    }
    return { bankCards: bank, creditCards: credit, totalChecking: totBank, totalCredit: totCredit };
  }, [accounts]);

  if (error) {
    return (
      <TabScreen>
        <ErrorState subtitle={error || undefined} onRetry={retry} />
      </TabScreen>
    );
  }

  if (!data) {
    return (
      <TabScreenScroll refreshing={refreshing} loading={loading} onRefresh={refresh}>
        <ListSkeleton />
      </TabScreenScroll>
    );
  }

  const topCategories = data.topCategories ?? [];
  const recentTransactions = data.recentTransactions ?? [];
  const monthlyIncome = data.monthlyIncome ?? 0;
  const monthlyExpenses = data.monthlyExpenses ?? 0;
  const heroTotal = totalChecking || (data.totalBalance ?? 0);

  return (
    <TabScreenScroll refreshing={refreshing} onRefresh={refresh}>
      <Text style={[styles.hello, { color: colors.brandTextPrimary }]}>
        Olá, {user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'pessoa'}
      </Text>
      <Text style={[styles.date, { color: colors.brandTextSecondary }]}>{formatDate(new Date())}</Text>

      <View
        style={[
          styles.balanceCard,
          { backgroundColor: colors.brandPrimaryDark, borderRadius: radius.xl, ...shadows.glow },
        ]}
      >
        <Text style={styles.balanceLabel}>Saldo em conta corrente</Text>
        <Text style={styles.balance}>{formatCurrency(heroTotal)}</Text>
        {totalCredit > 0 ? (
          <Text style={styles.balanceFootnote}>
            Cartão de crédito: −{formatCurrency(totalCredit)} em uso
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.summary,
          { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card },
        ]}
      >
        <View style={styles.summaryItem}>
          <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>Receitas</Text>
          <Text style={[styles.income, { color: colors.brandTextPositive }]}>{formatCurrency(monthlyIncome)}</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.brandDivider }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>Despesas</Text>
          <Text style={[styles.expense, { color: colors.brandTextNegative }]}>{formatCurrency(monthlyExpenses)}</Text>
        </View>
      </View>

      <IncomeExpenseBar
        income={monthlyIncome}
        expense={monthlyExpenses}
        colors={colors}
        radius={radius}
      />

      <Pressable
        onPress={() => navigation.navigate('WeeklySummary')}
        style={({ pressed }) => [
          styles.weeklyRow,
          { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={[styles.weeklyIcon, { backgroundColor: colors.brandPrimaryTint }]}>
          <Ionicons name="stats-chart" size={20} color={colors.brandPrimaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.weeklyTitle, { color: colors.brandTextPrimary }]}>Resumo da semana</Text>
          <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>Como foram seus últimos 7 dias</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.brandTextSecondary} />
      </Pressable>

      {bankCards.length > 0 ? (
        <>
          <SectionTitle>Contas correntes</SectionTitle>
          <View style={styles.cardsRow}>
            {bankCards.map((b) => (
              <View
                key={b.id}
                style={[styles.miniCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}
              >
                <BankBadge bankName={b.bankName} logoUrl={b.logoUrl} primaryColor={b.primaryColor} size={36} variant={b.isBrand ? 'filled' : 'padded'} />
                <Text style={[styles.miniCardLabel, { color: colors.brandTextSecondary }]} numberOfLines={1}>
                  {b.bankName}
                </Text>
                <Text style={[styles.miniCardValue, { color: colors.brandTextPrimary }]}>
                  {formatCurrency(b.balance)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {creditCards.length > 0 ? (
        <>
          <View style={styles.sectionRow}>
            <Text style={[styles.section, { color: colors.brandTextPrimary, marginTop: 0, marginBottom: 0 }]}>Faturas dos cartões</Text>
            <Pressable onPress={showStatementInfo} hitSlop={8}>
              <Ionicons name="information-circle-outline" size={18} color={colors.brandTextSecondary} />
            </Pressable>
          </View>
          <View style={{ gap: 10 }}>
            {creditCards.map((c) => (
              <View
                key={c.id}
                style={[styles.faturaCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}
              >
                <View style={styles.faturaHeader}>
                  <View style={styles.miniCardBadgeWrap}>
                    <BankBadge bankName={c.bankName} logoUrl={c.logoUrl} primaryColor={c.primaryColor} size={34} variant={c.isBrand ? 'filled' : 'padded'} />
                    <View style={[styles.miniCardBadgeCorner, { backgroundColor: colors.brandError }]}>
                      <Ionicons name="card" size={9} color="#FFFFFF" />
                    </View>
                  </View>
                  <Text style={[styles.faturaBank, { color: colors.brandTextPrimary }]} numberOfLines={1}>{c.bankName}</Text>
                  <Pressable onPress={() => handleEditCloseDay(c.id, c.creditCloseDay)} hitSlop={6} style={styles.closeDayRow}>
                    <Text style={[styles.closeDayText, { color: colors.brandTextSecondary }]} numberOfLines={1}>
                      {c.creditCloseDay ? `fecha ${c.creditCloseDay}` : 'definir'}
                    </Text>
                    <Ionicons name="pencil" size={11} color={colors.brandTextSecondary} />
                  </Pressable>
                </View>
                <View style={styles.faturaRow}>
                  <View style={styles.faturaCol}>
                    <Text style={[styles.faturaLabel, { color: colors.brandTextSecondary }]} numberOfLines={1}>
                      A pagar{c.dueDate ? ` · vence ${formatDate(c.dueDate)}` : ''}
                    </Text>
                    <Text style={[styles.faturaValueMain, { color: colors.brandTextNegative }]}>{formatCurrency(c.closedAmount)}</Text>
                  </View>
                  <View style={[styles.faturaVDivider, { backgroundColor: colors.brandDivider }]} />
                  <View style={styles.faturaCol}>
                    <Text style={[styles.faturaLabel, { color: colors.brandTextSecondary }]}>Aberta (este mês)</Text>
                    <Text style={[styles.faturaValueOpen, { color: colors.brandTextPrimary }]}>{formatCurrency(c.openAmount)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {portfolio && portfolio.groups.length > 0 ? (
        <>
          <SectionTitle onSeeAll={() => navigation.navigate('Ativos')}>Investimentos</SectionTitle>
          <Pressable
            onPress={() => navigation.navigate('Ativos')}
            style={({ pressed }) => [
              styles.groupCard,
              { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card },
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={[styles.categoryRow, topMovers.length > 0 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.brandDivider }]}>
              <View style={styles.categoryLeft}>
                <View style={[styles.weeklyIcon, { backgroundColor: colors.brandPrimaryTint }]}>
                  <Ionicons name="pie-chart" size={18} color={colors.brandPrimaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.categoryName, { color: colors.brandTextPrimary }]}>Patrimônio investido</Text>
                  <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>Rico, XP, Binance...</Text>
                </View>
              </View>
              <Text style={[styles.categoryAmount, { color: colors.brandTextPrimary }]}>
                {formatCurrency(portfolio.totals.current)}
              </Text>
            </View>
            {topMovers.map((it, i) => (
              <View
                key={it.id}
                style={[
                  styles.categoryRow,
                  i < topMovers.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.brandDivider },
                ]}
              >
                <View style={styles.categoryLeft}>
                  <Ionicons
                    name={(it.profitPct as number) >= 0 ? 'trending-up' : 'trending-down'}
                    size={16}
                    color={(it.profitPct as number) >= 0 ? colors.brandTextPositive : colors.brandTextNegative}
                  />
                  <Text style={[styles.categoryName, { color: colors.brandTextPrimary }]} numberOfLines={1}>{it.name}</Text>
                </View>
                <Text style={{ fontWeight: '800', fontSize: 14, color: (it.profitPct as number) >= 0 ? colors.brandTextPositive : colors.brandTextNegative }}>
                  {(it.profitPct as number) >= 0 ? '+' : ''}{(it.profitPct as number).toFixed(2)}%
                </Text>
              </View>
            ))}
          </Pressable>
        </>
      ) : null}

      {accounts.length === 0 ? (
        <Pressable
          onPress={() => navigation.navigate('ConnectBank')}
          style={({ pressed }) => [
            styles.connectCta,
            { backgroundColor: colors.brandSurface, borderRadius: radius.lg, borderColor: colors.brandDivider },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.brandPrimaryDark} />
          <Text style={[styles.connectCtaText, { color: colors.brandPrimaryDark }]}>Conectar primeira conta</Text>
        </Pressable>
      ) : null}

      <SectionTitle onSeeAll={() => navigation.navigate('Categorias')}>Maiores categorias</SectionTitle>
      {topCategories.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg }]}>
          <Text style={[styles.meta, { color: colors.brandTextSecondary, textAlign: 'center' }]}>
            Sem categorias neste mês
          </Text>
        </View>
      ) : (
        <View style={[styles.groupCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card }]}>
          {topCategories.map((cat, i) => (
            <Pressable
              key={cat.categoryId ?? cat.categoryName}
              onPress={() =>
                cat.categoryId &&
                navigation.navigate('CategoryDetail', {
                  categoryId: cat.categoryId,
                  categoryName: cat.categoryName,
                  categoryIcon: cat.categoryIcon,
                  categoryColor: cat.categoryColor,
                  month: format(new Date(), 'yyyy-MM'),
                })
              }
              style={({ pressed }) => [
                styles.categoryRow,
                i < topCategories.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.brandDivider,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={styles.categoryLeft}>
                <CategoryIcon icon={cat.categoryIcon} color={cat.categoryColor || colors.brandPrimary} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.categoryName, { color: colors.brandTextPrimary }]}>
                    {cat.categoryName || 'Categoria'}
                  </Text>
                  <Text style={[styles.meta, { color: colors.brandTextSecondary }]}>
                    {(cat as any).percentage != null ? `${(cat as any).percentage}% do mês` : ''}
                  </Text>
                </View>
              </View>
              <Text style={[styles.categoryAmount, { color: colors.brandTextPrimary }]}>
                {formatCurrency(cat.total ?? 0)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <SectionTitle onSeeAll={() => navigation.navigate('Transacoes')}>Transações recentes</SectionTitle>
      {recentTransactions.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg }]}>
          <Text style={[styles.meta, { color: colors.brandTextSecondary, textAlign: 'center' }]}>
            Nenhuma transação ainda
          </Text>
        </View>
      ) : (
        <View style={[styles.groupCard, { backgroundColor: colors.brandSurface, borderRadius: radius.lg, ...shadows.card, overflow: 'hidden' }]}>
          {recentTransactions.map((tx, i) => (
            <TransactionCard
              key={tx.id}
              item={tx}
              isFirst={i === 0}
              isLast={i === recentTransactions.length - 1}
              onPress={() => navigation.navigate('TransactionDetail', { transaction: tx })}
            />
          ))}
        </View>
      )}
    </TabScreenScroll>
  );
}

function SectionTitle({ children, onSeeAll }: { children: string; onSeeAll?: () => void }) {
  const { colors } = useTheme();
  if (!onSeeAll) {
    return <Text style={[styles.section, { color: colors.brandTextPrimary }]}>{children}</Text>;
  }
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.section, { color: colors.brandTextPrimary, marginTop: 0, marginBottom: 0 }]}>{children}</Text>
      <Pressable onPress={onSeeAll} hitSlop={8}>
        <Text style={[styles.seeAll, { color: colors.brandTextSecondary }]}>Ver tudo →</Text>
      </Pressable>
    </View>
  );
}

function IncomeExpenseBar({
  income,
  expense,
  colors,
  radius,
}: {
  income: number;
  expense: number;
  colors: any;
  radius: any;
}) {
  const total = income + expense;
  if (total <= 0) return null;
  const incomePct = (income / total) * 100;
  const expensePct = 100 - incomePct;
  return (
    <View style={[styles.barWrap, { backgroundColor: colors.brandSurface, borderRadius: radius.lg }]}>
      <Text style={[styles.barTitle, { color: colors.brandTextSecondary }]}>Receitas vs Despesas no mês</Text>
      <View style={[styles.barTrack, { backgroundColor: colors.brandDivider }]}>
        <View style={[styles.barIncome, { width: `${incomePct}%`, backgroundColor: colors.brandTextPositive }]} />
        <View style={[styles.barExpense, { width: `${expensePct}%`, backgroundColor: colors.brandTextNegative }]} />
      </View>
      <View style={styles.barLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.brandTextPositive }]} />
          <Text style={[styles.legendText, { color: colors.brandTextSecondary }]}>
            {incomePct.toFixed(0)}% receitas
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.brandTextNegative }]} />
          <Text style={[styles.legendText, { color: colors.brandTextSecondary }]}>
            {expensePct.toFixed(0)}% despesas
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hello: { fontSize: 24, fontWeight: '800' },
  date: { marginTop: 4, fontSize: 13 },
  balanceCard: { marginTop: 20, padding: 22 },
  balanceLabel: { color: '#FFFFFF', opacity: 0.85, fontSize: 13, fontWeight: '600' },
  balance: { marginTop: 8, color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  balanceFootnote: { marginTop: 8, color: '#FFFFFF', opacity: 0.8, fontSize: 12, fontWeight: '600' },
  summary: { marginTop: 16, paddingVertical: 18, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, height: 36 },
  weeklyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 14 },
  weeklyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  weeklyTitle: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 12 },
  income: { fontWeight: '800', fontSize: 18 },
  expense: { fontWeight: '800', fontSize: 18 },
  barWrap: { marginTop: 16, padding: 16 },
  barTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  barTrack: { height: 10, borderRadius: 5, flexDirection: 'row', overflow: 'hidden' },
  barIncome: { height: '100%' },
  barExpense: { height: '100%' },
  barLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },
  section: { marginTop: 28, marginBottom: 10, fontSize: 18, fontWeight: '800' },
  sectionRow: { marginTop: 28, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { fontSize: 13, fontWeight: '600' },
  cardsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  miniCard: { flex: 1, minWidth: 130, padding: 14, gap: 6 },
  miniCardIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  miniCardBadgeWrap: { position: 'relative', alignSelf: 'flex-start', marginBottom: 4 },
  miniCardBadgeCorner: { position: 'absolute', right: -4, bottom: -4, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#0F0F12' },
  miniCardLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  miniCardValue: { fontSize: 18, fontWeight: '900' },
  miniCardHint: { fontSize: 10, fontWeight: '600' },
  statementHintRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  closeDayRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closeDayText: { fontSize: 11, fontWeight: '500' },
  faturaCard: { padding: 14 },
  faturaHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  faturaBank: { flex: 1, fontSize: 14, fontWeight: '800' },
  faturaRow: { flexDirection: 'row', alignItems: 'stretch' },
  faturaCol: { flex: 1, gap: 3 },
  faturaLabel: { fontSize: 11, fontWeight: '600' },
  faturaValueMain: { fontSize: 20, fontWeight: '900' },
  faturaValueOpen: { fontSize: 20, fontWeight: '900' },
  faturaVDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  connectCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18, marginTop: 16, borderWidth: 1, borderStyle: 'dashed' },
  connectCtaText: { fontSize: 14, fontWeight: '700' },
  emptyCard: { padding: 24 },
  groupCard: { overflow: 'hidden' },
  categoryRow: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  categoryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  categoryIconText: { fontSize: 18 },
  categoryName: { fontWeight: '700', fontSize: 14 },
  categoryAmount: { fontWeight: '800', fontSize: 15 },
});
