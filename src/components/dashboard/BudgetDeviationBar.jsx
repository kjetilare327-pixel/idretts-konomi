import React from 'react';

export default function BudgetDeviationBar({ category, spent, budgeted }) {
  if (!budgeted || budgeted === 0) return null;
  const pct = Math.round((spent / budgeted) * 100);
  const barColor = pct <= 75 ? 'bg-emerald-500' : pct <= 100 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = pct <= 75 ? 'text-emerald-600' : pct <= 100 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{category}</span>
        <span className={`font-semibold ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{new Intl.NumberFormat('nb-NO').format(spent)} kr brukt</span>
        <span>{new Intl.NumberFormat('nb-NO').format(budgeted)} kr budsjett</span>
      </div>
    </div>
  );
}