import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CheckCircle2, Circle, ChevronRight, Rocket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const SETUP_STEPS = [
  {
    id: 'players',
    label: 'Legg til spillere',
    description: 'Importer eller legg til spillere manuelt',
    page: 'Players',
  },
  {
    id: 'transactions',
    label: 'Importer transaksjoner',
    description: 'Last opp CSV eller koble til bank',
    page: 'Transactions',
  },
  {
    id: 'claims',
    label: 'Opprett første krav',
    description: 'Kontingent, dugnad eller annet',
    page: 'Players',
  },
  {
    id: 'send_claims',
    label: 'Send krav til spillere',
    description: 'Send e-post eller varsel',
    page: 'Communications',
  },
  {
    id: 'bank_matching',
    label: 'Kjør bankmatching',
    description: 'Match betalinger eller marker betalt',
    page: 'BankReconciliation',
  },
];

export function getCompletedSteps(players, transactions, claims, sentMessages) {
  const completed = new Set();
  if (players?.length > 0) completed.add('players');
  if (transactions?.length > 0) completed.add('transactions');
  if (claims?.length > 0) completed.add('claims');
  if (sentMessages?.length > 0 || claims?.some(c => c.last_reminder_sent)) completed.add('send_claims');
  if (claims?.some(c => c.status === 'paid')) completed.add('bank_matching');
  return completed;
}

export function isSetupComplete(completedSteps) {
  return SETUP_STEPS.every(s => completedSteps.has(s.id));
}

export function isCoreSetupDone(completedSteps) {
  // Steps 1–3 (players, transactions, claims)
  return ['players', 'transactions', 'claims'].every(s => completedSteps.has(s));
}

export default function SetupProgress({ completedSteps, onDismiss }) {
  const total = SETUP_STEPS.length;
  const done = SETUP_STEPS.filter(s => completedSteps.has(s.id)).length;
  const pct = Math.round((done / total) * 100);

  if (isSetupComplete(completedSteps)) return null;

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900 overflow-hidden">
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">Kom i gang</p>
              <p className="text-xs text-slate-500">{done} av {total} steg fullført</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-0.5"
          >
            Skjul
          </button>
        </div>

        <div className="space-y-2">
          {SETUP_STEPS.map((step, idx) => {
            const isDone = completedSteps.has(step.id);
            const isNext = !isDone && SETUP_STEPS.slice(0, idx).every(s => completedSteps.has(s.id));
            return (
              <Link
                key={step.id}
                to={createPageUrl(step.page)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                  isNext
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'
                    : isDone
                    ? 'opacity-60'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className={`w-5 h-5 shrink-0 ${isNext ? 'text-emerald-400' : 'text-slate-300 dark:text-slate-600'}`} />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isDone ? 'line-through text-slate-400' : ''}`}>{step.label}</p>
                  {!isDone && <p className="text-xs text-slate-400 truncate">{step.description}</p>}
                </div>
                {!isDone && (
                  <ChevronRight className={`w-4 h-4 shrink-0 ${isNext ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'} group-hover:translate-x-0.5 transition-transform`} />
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}