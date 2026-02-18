import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNOK } from '@/components/shared/FormatUtils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Calendar, TrendingDown, TrendingUp } from 'lucide-react';

const HORIZONS = [
  { label: '30 dager', days: 30 },
  { label: '60 dager', days: 60 },
  { label: '90 dager', days: 90 },
];

function buildForecast(transactions, claims, budgets, days) {
  const today = new Date();
  // Build monthly averages from past 3 months
  const past3 = new Date(today);
  past3.setMonth(past3.getMonth() - 3);

  const recent = transactions.filter(t => t.date && new Date(t.date) >= past3);
  const avgDailyIncome = recent.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) / 90;
  const avgDailyExpense = recent.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) / 90;

  const currentBalance = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    - transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Known future cashflows from claims
  const futureClaims = claims
    .filter(c => (c.status === 'pending' || c.status === 'overdue') && c.due_date)
    .map(c => ({ date: new Date(c.due_date), amount: c.amount, type: 'income', label: c.type }));

  // Known budget expenses (monthly)
  const monthlyBudgetExpenses = budgets
    .filter(b => b.type === 'expense')
    .reduce((s, b) => s + (b.monthly_amount || 0), 0);
  const dailyBudgetExpense = monthlyBudgetExpenses / 30;

  const points = [];
  let runningBalance = currentBalance;

  for (let d = 0; d <= days; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    const dateStr = date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });

    // Add known claim income on due dates
    const claimIncome = futureClaims
      .filter(c => c.date.toDateString() === date.toDateString())
      .reduce((s, c) => s + c.amount, 0);

    const dailyIn = avgDailyIncome + claimIncome;
    const dailyOut = avgDailyExpense + dailyBudgetExpense;
    runningBalance += dailyIn - dailyOut;

    if (d % Math.ceil(days / 20) === 0 || d === days) {
      points.push({
        date: dateStr,
        day: d,
        balance: Math.round(runningBalance),
        projected: Math.round(runningBalance),
        income: Math.round(dailyIn),
        expense: Math.round(dailyOut),
        claimIncome: Math.round(claimIncome),
      });
    }
  }
  return points;
}

export default function CashFlowForecast({ transactions, claims, budgets }) {
  const [horizon, setHorizon] = useState(30);

  const forecastData = useMemo(
    () => buildForecast(transactions, claims, budgets, horizon),
    [transactions, claims, budgets, horizon]
  );

  const minBalance = Math.min(...forecastData.map(p => p.balance));
  const maxBalance = Math.max(...forecastData.map(p => p.balance));
  const endBalance = forecastData[forecastData.length - 1]?.balance ?? 0;
  const startBalance = forecastData[0]?.balance ?? 0;
  const trend = endBalance - startBalance;

  const riskPeriods = forecastData.filter(p => p.balance < 0);

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              Kortsiktig kontantstrømprognose
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Basert på historiske data og kjente fremtidige krav</p>
          </div>
          <div className="flex gap-2">
            {HORIZONS.map(h => (
              <Button
                key={h.days}
                size="sm"
                variant={horizon === h.days ? 'default' : 'outline'}
                onClick={() => setHorizon(h.days)}
                className={horizon === h.days ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                {h.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-xs text-slate-500">Forventet saldo</p>
            <p className={`text-lg font-bold ${endBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatNOK(endBalance)}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-xs text-slate-500">Trend</p>
            <p className={`text-lg font-bold flex items-center justify-center gap-1 ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {formatNOK(Math.abs(trend))}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-xs text-slate-500">Laveste punkt</p>
            <p className={`text-lg font-bold ${minBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatNOK(minBalance)}
            </p>
          </div>
        </div>

        {riskPeriods.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            ⚠️ Mulig likviditetsmangel i {riskPeriods.length} perioder innen {horizon} dager.
          </div>
        )}

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => formatNOK(v)} labelStyle={{ fontWeight: 600 }} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '0', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
              <Area type="monotone" dataKey="balance" name="Saldo" stroke="#10b981" fill="url(#balGrad)" strokeWidth={2} dot={false} />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}