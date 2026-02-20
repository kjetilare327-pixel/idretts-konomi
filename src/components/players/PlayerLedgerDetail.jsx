/**
 * PlayerLedgerDetail – "Kilder til saldo" panel
 * Shows a full breakdown of claims vs payments explaining the current balance.
 */
import React from 'react';
import { formatNOK } from '@/components/shared/FormatUtils';
import { STATUS_CONFIG } from '@/components/shared/useLedger';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const CLAIM_TYPE_LABELS = {
  kontingent: 'Kontingent',
  cup: 'Cup',
  dugnad: 'Dugnad',
  utstyr: 'Utstyr',
  annet: 'Annet',
};

function claimStatusIcon(status) {
  if (status === 'paid') return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
  if (status === 'overdue') return <AlertCircle className="w-3.5 h-3.5 text-rose-500" />;
  return <Clock className="w-3.5 h-3.5 text-amber-500" />;
}

export default function PlayerLedgerDetail({ ledger }) {
  const { balance, totalCharged, totalPaid, status, claims, payments } = ledger;
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;

  return (
    <div className="space-y-4">
      {/* Balance summary */}
      <div className={`rounded-xl p-4 ${cfg.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Beregnet saldo</p>
            <p className={`text-2xl font-bold ${cfg.color}`}>
              {balance > 0
                ? `Skylder ${formatNOK(balance)}`
                : balance < 0
                ? `Kreditt ${formatNOK(-balance)}`
                : 'Ingen utestående'}
            </p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badgeClass}`}>
            {cfg.label}
          </span>
        </div>
        <div className="flex gap-6 mt-3 text-xs text-slate-500">
          <span>Tildelt: <strong className="text-slate-700 dark:text-slate-300">{formatNOK(totalCharged)}</strong></span>
          <span>Innbetalt: <strong className="text-emerald-600">{formatNOK(totalPaid)}</strong></span>
        </div>
      </div>

      {/* Claims */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> Krav ({claims.length})
        </h4>
        {claims.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Ingen krav</p>
        ) : (
          <div className="space-y-1.5">
            {claims.map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  {claimStatusIcon(c.status)}
                  <div>
                    <span className="font-medium">{CLAIM_TYPE_LABELS[c.type] || c.type}</span>
                    {c.description && <span className="text-slate-400 ml-1.5 text-xs">– {c.description}</span>}
                    {c.due_date && (
                      <span className={`ml-2 text-xs ${new Date(c.due_date) < new Date() && c.status !== 'paid' ? 'text-rose-500' : 'text-slate-400'}`}>
                        Forfall: {new Date(c.due_date).toLocaleDateString('nb-NO')}
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-semibold text-red-600">+{formatNOK(c.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payments */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5" /> Innbetalinger ({payments.length})
        </h4>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Ingen registrerte innbetalinger</p>
        ) : (
          <div className="space-y-1.5">
            {payments.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <div>
                    <span className="font-medium capitalize">{p.payment_method?.replace('_', ' ') || 'Betaling'}</span>
                    {p.paid_at && (
                      <span className="text-slate-400 ml-2 text-xs">
                        {new Date(p.paid_at).toLocaleDateString('nb-NO')}
                      </span>
                    )}
                    {p.notes && <span className="text-slate-400 ml-1.5 text-xs">– {p.notes}</span>}
                  </div>
                </div>
                <span className="font-semibold text-emerald-600">–{formatNOK(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ledger formula */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-500 font-mono">
        Saldo = {formatNOK(totalCharged)} (krav) − {formatNOK(totalPaid)} (innbetalt) = <strong className={cfg.color}>{formatNOK(balance)}</strong>
      </div>
    </div>
  );
}