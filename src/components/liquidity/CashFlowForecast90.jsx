import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { formatNOK } from '@/components/shared/FormatUtils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const HORIZON_OPTIONS = [
  { label: '30 dager', days: 30 },
  { label: '60 dager', days: 60 },
  { label: '90 dager', days: 90 },
];

export default function CashFlowForecast90({ transactions = [], claims = [], budgets = [], sponsors = [] }) {
  const [horizon, setHorizon] = useState(90);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const forecast = useMemo(() => {
    const today = new Date();
    // Current balance from all transactions
    const startBalance = transactions.reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, 0);

    // Monthly averages (last 3 months)
    const avgIncome = (() => {
      const last3 = Array.from({ length: 3 }, (_, i) => {
        const d = new Date(today);
        d.setMonth(d.getMonth() - i);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return transactions.filter(t => t.type === 'income' && t.date?.startsWith(ym)).reduce((s, t) => s + t.amount, 0);
      });
      return last3.reduce((a, b) => a + b, 0) / 3;
    })();

    const avgExpense = (() => {
      const last3 = Array.from({ length: 3 }, (_, i) => {
        const d = new Date(today);
        d.setMonth(d.getMonth() - i);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return transactions.filter(t => t.type === 'expense' && t.date?.startsWith(ym)).reduce((s, t) => s + t.amount, 0);
      });
      return last3.reduce((a, b) => a + b, 0) / 3;
    })();

    const dailyIncome = avgIncome / 30;
    const dailyExpense = avgExpense / 30;

    // Known future claims (pending/overdue)
    const futureClaims = claims.filter(c => c.status === 'pending' || c.status === 'overdue');

    // Known sponsor payments
    const futureSponsors = (sponsors || []).filter(s => s.status === 'active' && s.next_payment_date);

    // Build daily data points
    const points = [];
    let balance = startBalance;
    let minBalance = startBalance;
    let minDay = 0;
    let shortfallDays = 0;

    for (let day = 1; day <= horizon; day++) {
      const d = new Date(today);
      d.setDate(d.getDate() + day);
      const dateStr = d.toISOString().split('T')[0];

      let dayIncome = dailyIncome;
      let dayExpense = dailyExpense;

      // Add known claim income
      futureClaims.forEach(c => {
        if (c.due_date === dateStr) dayIncome += c.amount;
      });

      // Add known sponsor payments
      futureSponsors.forEach(s => {
        if (s.next_payment_date === dateStr) dayIncome += s.amount;
      });

      balance += dayIncome - dayExpense;
      if (balance < minBalance) { minBalance = balance; minDay = day; }
      if (balance < 0) shortfallDays++;

      // Only keep every 5th point for performance, plus always keep day 1, 30, 60, 90
      if (day % 5 === 0 || [1, 30, 60, 90].includes(day)) {
        points.push({
          day: `Dag ${day}`,
          balance: Math.round(balance),
          income: Math.round(dayIncome * 5),
          expense: Math.round(dayExpense * 5),
          date: dateStr,
          isLow: balance < 0,
        });
      }
    }

    return {
      points,
      startBalance,
      endBalance: balance,
      minBalance,
      minDay,
      shortfallDays,
      dailyIncome,
      dailyExpense,
      netDaily: dailyIncome - dailyExpense,
    };
  }, [transactions, claims, budgets, sponsors, horizon]);

  const runAI = async () => {
    setLoadingAi(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Du er økonomiekspert for norske idrettslag. Analyser følgende likviditetsprognose og gi konkrete råd:

Startbalanse: ${formatNOK(forecast.startBalance)}
Sluttbalanse etter ${horizon} dager: ${formatNOK(forecast.endBalance)}
Laveste balanse: ${formatNOK(forecast.minBalance)} (dag ${forecast.minDay})
Dager med negativ balanse: ${forecast.shortfallDays}
Daglig nettokassastrøm: ${formatNOK(forecast.netDaily)}

Gi:
1. Vurdering av likviditetssituasjonen
2. Identifiser risikoperioder
3. 3-5 konkrete tiltak for å optimalisere kontantstrøm
4. Spesifikke anbefalinger for evt. overskudds- eller underskuddsperioder

Svar kortfattet på norsk.`,
    });
    setAiAdvice(res);
    setLoadingAi(false);
  };

  const endChange = forecast.endBalance - forecast.startBalance;

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Kontantstrømprognose</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Basert på historiske gjennomsnitt og kjente betalinger</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              {HORIZON_OPTIONS.map(opt => (
                <button key={opt.days} onClick={() => setHorizon(opt.days)}
                  className={`px-3 py-1.5 text-xs font-medium transition-all ${horizon === opt.days ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={runAI} disabled={loadingAi} className="gap-1.5 h-8">
              {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-purple-500" />}
              AI-råd
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-xs text-slate-500">Nå</p>
            <p className={`text-lg font-bold ${forecast.startBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatNOK(forecast.startBalance)}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-xs text-slate-500">Om {horizon} dager</p>
            <p className={`text-lg font-bold ${forecast.endBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatNOK(forecast.endBalance)}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-xs text-slate-500">Laveste punkt</p>
            <p className={`text-lg font-bold ${forecast.minBalance >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{formatNOK(forecast.minBalance)}</p>
            <p className="text-xs text-slate-400">Dag {forecast.minDay}</p>
          </div>
          <div className={`p-3 rounded-lg ${endChange >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
            <p className="text-xs text-slate-500">Endring</p>
            <p className={`text-lg font-bold flex items-center gap-1 ${endChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {endChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {endChange >= 0 ? '+' : ''}{formatNOK(endChange)}
            </p>
          </div>
        </div>

        {/* Shortfall warning */}
        {forecast.shortfallDays > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">
              Prognosen viser <strong>{forecast.shortfallDays} dager</strong> med negativ saldo de neste {horizon} dagene. Vurder tiltak for å sikre likviditeten.
            </p>
          </div>
        )}

        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecast.points} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => formatNOK(v)} />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
              <Area type="monotone" dataKey="balance" name="Saldo" stroke="#10b981" strokeWidth={2} fill="url(#balGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* AI advice */}
        {aiAdvice && (
          <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5" /> AI-analyse
            </p>
            <ReactMarkdown className="prose prose-sm prose-slate dark:prose-invert max-w-none text-xs">{aiAdvice}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}