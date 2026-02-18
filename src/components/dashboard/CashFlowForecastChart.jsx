import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { formatNOK } from '@/components/shared/FormatUtils';

const MONTHS_NB = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des'];

export default function CashFlowForecastChart({ transactions = [], budgets = [] }) {
  const chartData = useMemo(() => {
    const now = new Date();

    // Build historical monthly data (last 6 months)
    const historical = {};
    transactions.forEach(t => {
      if (!t.date || t.status === 'archived' || t.status === 'annulled') return;
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!historical[key]) historical[key] = { income: 0, expense: 0 };
      if (t.type === 'income') historical[key].income += t.amount;
      else historical[key].expense += t.amount;
    });

    // Average from last 3 months of history
    const pastKeys = Object.keys(historical).sort().slice(-3);
    const avgIncome = pastKeys.length > 0
      ? pastKeys.reduce((s, k) => s + historical[k].income, 0) / pastKeys.length
      : 0;
    const avgExpense = pastKeys.length > 0
      ? pastKeys.reduce((s, k) => s + historical[k].expense, 0) / pastKeys.length
      : 0;

    // Budget monthly amounts
    const budgetIncome = budgets.filter(b => b.type === 'income').reduce((s, b) => s + b.monthly_amount, 0);
    const budgetExpense = budgets.filter(b => b.type === 'expense').reduce((s, b) => s + b.monthly_amount, 0);

    const points = [];
    let cumulativeCurrent = 0;
    let cumulativeBudget = 0;

    for (let offset = -5; offset <= 6; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTHS_NB[d.getMonth()]} ${d.getFullYear() !== now.getFullYear() ? d.getFullYear() : ''}`.trim();
      const isFuture = offset > 0;
      const isCurrent = offset === 0;

      if (!isFuture) {
        const h = historical[key] || { income: 0, expense: 0 };
        cumulativeCurrent += h.income - h.expense;
        points.push({
          label,
          key,
          isFuture: false,
          isCurrent,
          'Inntekt': h.income,
          'Utgift': h.expense,
          'Netto (faktisk)': h.income - h.expense,
          'Kumulativ saldo': Math.round(cumulativeCurrent),
        });
      } else {
        const projIncome = budgetIncome > 0 ? budgetIncome : avgIncome;
        const projExpense = budgetExpense > 0 ? budgetExpense : avgExpense;
        cumulativeBudget = cumulativeCurrent + (projIncome - projExpense) * offset;
        cumulativeCurrent += projIncome - projExpense;
        points.push({
          label,
          key,
          isFuture: true,
          isCurrent: false,
          'Projisert inntekt': Math.round(projIncome),
          'Projisert utgift': Math.round(projExpense),
          'Projisert netto': Math.round(projIncome - projExpense),
          'Kumulativ saldo': Math.round(cumulativeCurrent),
        });
      }
    }
    return points;
  }, [transactions, budgets]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white dark:bg-slate-800 shadow-lg rounded-lg p-3 border text-xs">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex justify-between gap-4">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-medium">{formatNOK(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const splitIndex = chartData.findIndex(d => d.isFuture);

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Kontantstrøm – historikk og prognose</CardTitle>
        <CardDescription>Siste 6 måneder (faktisk) + neste 6 måneder (projisert fra budsjett)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={45} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {splitIndex > 0 && (
              <ReferenceLine x={chartData[splitIndex]?.label} stroke="#6366f1" strokeDasharray="5 3" label={{ value: 'Prognose →', fill: '#6366f1', fontSize: 10 }} />
            )}
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <Bar dataKey="Inntekt" fill="#10b981" opacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={20} />
            <Bar dataKey="Utgift" fill="#f43f5e" opacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={20} />
            <Bar dataKey="Projisert inntekt" fill="#6ee7b7" opacity={0.6} radius={[2, 2, 0, 0]} maxBarSize={20} />
            <Bar dataKey="Projisert utgift" fill="#fca5a5" opacity={0.6} radius={[2, 2, 0, 0]} maxBarSize={20} />
            <Line type="monotone" dataKey="Kumulativ saldo" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}