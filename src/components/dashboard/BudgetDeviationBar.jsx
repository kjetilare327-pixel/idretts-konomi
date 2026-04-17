import React from 'react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function BudgetDeviationBar({ category, spent, budgeted }) {
  if (!budgeted || budgeted === 0) return null;
  const pct = Math.round((spent / budgeted) * 100);
  const barColor = pct <= 75 ? 'bg-emerald-500' : pct <= 100 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = pct <= 75 ? 'text-emerald-600' : pct <= 100 ? 'text-amber-600' : 'text-red-600';
  const remaining = budgeted - spent;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{category}</span>
        <div className="flex items-center gap-2">
          {pct > 100 && <span className="text-xs bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 px-1.5 py-0.5 rounded font-semibold">Over budsjett</span>}
          <span className={`font-semibold ${textColor}`}>{pct} %</span>
        </div>
      </div>
      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{formatNOK(spent)} brukt</span>
        <span className={remaining < 0 ? 'text-red-500 font-medium' : ''}>
          {remaining >= 0 ? `${formatNOK(remaining)} igjen` : `${formatNOK(Math.abs(remaining))} over`}
        </span>
        <span>{formatNOK(budgeted)} budsjett</span>
      </div>
    </div>
  );
}