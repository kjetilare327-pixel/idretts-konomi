import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Settings, GripVertical, X, Plus } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

const AVAILABLE_KPIS = [
  { id: 'total_balance', label: 'Total saldo', group: 'økonomi' },
  { id: 'month_net', label: 'Netto denne måneden', group: 'økonomi' },
  { id: 'year_income', label: 'Inntekter i år', group: 'økonomi' },
  { id: 'year_expense', label: 'Utgifter i år', group: 'økonomi' },
  { id: 'budget_usage', label: 'Budsjettforbruk (%)', group: 'budsjett' },
  { id: 'outstanding_claims', label: 'Utestående krav', group: 'krav' },
  { id: 'overdue_claims', label: 'Forfalt krav', group: 'krav' },
  { id: 'unpaid_members', label: 'Ubetalt medlemmer', group: 'krav' },
  { id: 'avg_monthly_expense', label: 'Snitt månedlig utgift', group: 'økonomi' },
  { id: 'cashflow_trend', label: 'Kontantstrøm-trend', group: 'økonomi' },
];

const STORAGE_KEY = 'dashboard_selected_kpis';

function computeKPIValue(kpiId, transactions, budgets, claims, players) {
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const curYear = String(now.getFullYear());

  switch (kpiId) {
    case 'total_balance': {
      const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return { value: formatNOK(income - expense), color: (income - expense) >= 0 ? 'text-emerald-600' : 'text-red-600' };
    }
    case 'month_net': {
      const mi = transactions.filter(t => t.type === 'income' && t.date?.startsWith(curMonth)).reduce((s, t) => s + t.amount, 0);
      const me = transactions.filter(t => t.type === 'expense' && t.date?.startsWith(curMonth)).reduce((s, t) => s + t.amount, 0);
      return { value: formatNOK(mi - me), color: (mi - me) >= 0 ? 'text-emerald-600' : 'text-red-600' };
    }
    case 'year_income': {
      const v = transactions.filter(t => t.type === 'income' && t.date?.startsWith(curYear)).reduce((s, t) => s + t.amount, 0);
      return { value: formatNOK(v), color: 'text-emerald-600' };
    }
    case 'year_expense': {
      const v = transactions.filter(t => t.type === 'expense' && t.date?.startsWith(curYear)).reduce((s, t) => s + t.amount, 0);
      return { value: formatNOK(v), color: 'text-red-600' };
    }
    case 'budget_usage': {
      const budgetTotal = budgets.filter(b => b.type === 'expense').reduce((s, b) => s + b.monthly_amount, 0);
      const spent = transactions.filter(t => t.type === 'expense' && t.date?.startsWith(curMonth)).reduce((s, t) => s + t.amount, 0);
      const pct = budgetTotal > 0 ? Math.round((spent / budgetTotal) * 100) : 0;
      return { value: `${pct}%`, color: pct > 100 ? 'text-red-600' : pct > 80 ? 'text-amber-600' : 'text-emerald-600' };
    }
    case 'outstanding_claims': {
      const v = claims.filter(c => c.status !== 'paid' && c.status !== 'cancelled').reduce((s, c) => s + c.amount, 0);
      return { value: formatNOK(v), color: v > 0 ? 'text-amber-600' : 'text-emerald-600' };
    }
    case 'overdue_claims': {
      const v = claims.filter(c => c.status === 'overdue').reduce((s, c) => s + c.amount, 0);
      return { value: formatNOK(v), color: v > 0 ? 'text-red-600' : 'text-emerald-600' };
    }
    case 'unpaid_members': {
      const count = (players || []).filter(p => p.payment_status !== 'paid').length;
      return { value: `${count} stk`, color: count > 0 ? 'text-amber-600' : 'text-emerald-600' };
    }
    case 'avg_monthly_expense': {
      const months = new Set(transactions.filter(t => t.type === 'expense').map(t => t.date?.slice(0, 7)).filter(Boolean));
      const total = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return { value: formatNOK(months.size > 0 ? total / months.size : 0), color: 'text-slate-700 dark:text-slate-300' };
    }
    case 'cashflow_trend': {
      const sorted = [...new Set(transactions.map(t => t.date?.slice(0, 7)).filter(Boolean))].sort().slice(-2);
      if (sorted.length < 2) return { value: 'Ingen data', color: 'text-slate-500' };
      const net = (m) => {
        const i = transactions.filter(t => t.type === 'income' && t.date?.startsWith(m)).reduce((s, t) => s + t.amount, 0);
        const e = transactions.filter(t => t.type === 'expense' && t.date?.startsWith(m)).reduce((s, t) => s + t.amount, 0);
        return i - e;
      };
      const diff = net(sorted[1]) - net(sorted[0]);
      return { value: `${diff >= 0 ? '+' : ''}${formatNOK(diff)}`, color: diff >= 0 ? 'text-emerald-600' : 'text-red-600' };
    }
    default:
      return { value: '–', color: 'text-slate-500' };
  }
}

export default function CustomDashboardKPIs({ transactions = [], budgets = [], claims = [], players = [] }) {
  const [selected, setSelected] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '["total_balance","month_net","outstanding_claims","budget_usage"]'); }
    catch { return ['total_balance', 'month_net', 'outstanding_claims', 'budget_usage']; }
  });
  const [editing, setEditing] = useState(false);

  const toggle = (id) => {
    const updated = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    setSelected(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const selectedKPIs = AVAILABLE_KPIS.filter(k => selected.includes(k.id));

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mine KPI-er</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)} className="gap-1.5 h-7 text-xs">
            <Settings className="w-3.5 h-3.5" />
            {editing ? 'Ferdig' : 'Tilpass'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Velg hvilke KPI-er som skal vises på dashbordet:</p>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_KPIS.map(k => (
                <div key={k.id} className="flex items-center gap-2">
                  <Checkbox id={k.id} checked={selected.includes(k.id)} onCheckedChange={() => toggle(k.id)} />
                  <label htmlFor={k.id} className="text-xs cursor-pointer flex-1">{k.label}</label>
                  <Badge variant="outline" className="text-xs py-0">{k.group}</Badge>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {selectedKPIs.map(k => {
              const computed = computeKPIValue(k.id, transactions, budgets, claims, players);
              return (
                <div key={k.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500 mb-1 leading-tight">{k.label}</p>
                  <p className={`text-base font-bold ${computed.color}`}>{computed.value}</p>
                </div>
              );
            })}
            {selectedKPIs.length === 0 && (
              <div className="col-span-4 text-center py-4 text-sm text-slate-400">
                Ingen KPI-er valgt. Klikk «Tilpass» for å legge til.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}