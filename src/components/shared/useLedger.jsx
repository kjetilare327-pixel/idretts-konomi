/**
 * useLedger – canonical ledger logic for player balances and payment status.
 *
 * Rules:
 *   balance  = sum(active claims) - sum(completed payments)
 *   status:
 *     'paid'    → balance == 0
 *     'overdue' → balance > 0 AND any claim has due_date < today
 *     'partial' → balance > 0 AND sum(payments) > 0
 *     'unpaid'  → balance > 0 AND sum(payments) == 0
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

/** Pure function – compute ledger for ONE player given all claims + payments arrays */
export function computePlayerLedger(playerId, claims, payments) {
  const playerClaims = claims.filter(
    c => c.player_id === playerId && c.status !== 'cancelled'
  );
  const playerPayments = payments.filter(
    p => p.player_id === playerId && p.status === 'completed'
  );

  const totalCharged = playerClaims.reduce((s, c) => s + (c.amount || 0), 0);
  const totalPaid    = playerPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const balance      = totalCharged - totalPaid;

  const hasOverdue = playerClaims.some(c => {
    if (c.status === 'paid') return false;
    if (!c.due_date) return false;
    return new Date(c.due_date) < TODAY;
  });

  let status;
  if (balance <= 0) {
    status = 'paid';
  } else if (hasOverdue) {
    status = 'overdue';
  } else if (totalPaid > 0) {
    status = 'partial';
  } else {
    status = 'unpaid';
  }

  return {
    balance,
    totalCharged,
    totalPaid,
    status,
    claims: playerClaims,
    payments: playerPayments,
  };
}

/** Hook – loads claims + payments for a team and returns per-player ledger map */
export function useLedger(teamId) {
  const { data: claims = [], isLoading: loadingClaims } = useQuery({
    queryKey: ['claims', teamId],
    queryFn: () => base44.entities.Claim.filter({ team_id: teamId }),
    enabled: !!teamId,
    staleTime: 30_000,
  });

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['payments', teamId],
    queryFn: () => base44.entities.Payment.filter({ team_id: teamId }),
    enabled: !!teamId,
    staleTime: 30_000,
  });

  const ledgerMap = useMemo(() => {
    const map = {};
    const playerIds = [
      ...new Set([
        ...claims.map(c => c.player_id),
        ...payments.map(p => p.player_id),
      ]),
    ];
    for (const pid of playerIds) {
      map[pid] = computePlayerLedger(pid, claims, payments);
    }
    return map;
  }, [claims, payments]);

  return {
    ledgerMap,
    claims,
    payments,
    isLoading: loadingClaims || loadingPayments,
  };
}

/** Returns status label + colors */
export const STATUS_CONFIG = {
  paid:    { label: 'Betalt',   color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
  partial: { label: 'Delvis',   color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-500/10',     badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
  unpaid:  { label: 'Ubetalt',  color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-500/10',         badgeClass: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
  overdue: { label: 'Forfalt',  color: 'text-rose-700',    bg: 'bg-rose-50 dark:bg-rose-500/10',       badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' },
};