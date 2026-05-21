import { useCallback, useEffect, useState } from 'react';
import { investmentsService, CreateRuleBody, UpdateRuleBody } from '@/services/investments.service';
import { normalizeError } from '@/lib/errorMap';
import type { InvestmentPendingAction, InvestmentRule } from '@/types/api.types';

export function useInvestmentRules() {
  const [rules, setRules] = useState<InvestmentRule[]>([]);
  const [pending, setPending] = useState<InvestmentPendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    mode === 'refresh' ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [rulesRes, pendingRes] = await Promise.all([
        investmentsService.listRules(),
        investmentsService.listPending(false),
      ]);
      setRules(rulesRes.rules);
      setPending(pendingRes.items);
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const create = useCallback(async (body: CreateRuleBody) => {
    await investmentsService.createRule(body);
    await load();
  }, [load]);

  const update = useCallback(async (id: string, body: UpdateRuleBody) => {
    setBusyId(id);
    try {
      await investmentsService.updateRule(id, body);
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const remove = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await investmentsService.deleteRule(id);
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const toggleActive = useCallback(async (rule: InvestmentRule) => {
    await update(rule.id, { active: !rule.active });
  }, [update]);

  const approve = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await investmentsService.approvePending(id);
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const dismiss = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await investmentsService.dismissPending(id);
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    rules,
    pending,
    loading,
    refreshing,
    error,
    busyId,
    reload: () => load('refresh'),
    create,
    update,
    remove,
    toggleActive,
    approve,
    dismiss,
  };
}
