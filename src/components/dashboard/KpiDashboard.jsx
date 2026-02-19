import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNOK } from '@/components/shared/FormatUtils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];

function KpiCard({ title, value, sub, icon: Icon, color, trend, trendLabel }) {
  const colors = {
    green: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600', border: 'border-emerald-100 dark:border-emerald-800' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600', border: 'border-red-100 dark:border-red-800' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600', border: 'border-blue-100 dark:border-blue-800' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600', border: 'border-amber-100 dark:border-amber-800' },
  };
  const c = colors[color] || colors.blue;
  return (
    <Card className={`border shadow-sm ${c.border}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <div className={`p-2 rounded-lg ${c.bg}`}>
            <Icon className={`w-4 h-4 ${c.icon}`} />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            {trend >= 0
              ? <TrendingUp className="w-3 h-3 text-emerald-500" />
              : <TrendingDown className="w-3 h-3 text-red-500" />}
            <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400">{trendLabel || 'vs forrige mnd'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function KpiDashboard({ transactions = [], budgets = [], claims = [] }) {
  const now = new Date();
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const { kpis, trendData, budgetVariances, claimsStats } = useMemo(() => {
    const cur = { income: 0, expense: 0 };
    const prev = { income: 0, expense: 0 };
    const monthMap = {};

    // Build 12-month trend
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = { name: MONTH_NAMES[d.getMonth()], inntekter: 0, utgifter: 0, netto: 0 };
    }

    transactions.forEach(t => {
      const k = t.date?.substring(0, 7);
      if (k === curMonthKey) t.type === 'income' ? (cur.income += t.amount) : (cur.expense += t.amount);
      if (k === prevMonthKey) t.type === 'income' ? (prev.income += t.amount) : (prev.expense += t.amount);
      if (monthMap[k]) {
        if (t.type === 'income') monthMap[k].inntekter += t.amount;
        else monthMap[k].utgifter += t.amount;
        monthMap[k].netto = monthMap[k].inntekter - monthMap[k].utgifter;
      }
    });

    const incTrend = prev.income > 0 ? ((cur.income - prev.income) / prev.income) * 100 : 0;
    const expTrend = prev.expense > 0 ? ((cur.expense - prev.expense) / prev.expense) * 100 : 0;

    // Budget variances
    const expByCat = {};
    transactions.filter(t => t.type === 'expense' && t.date?.startsWith(curMonthKey)).forEach(t => {
      expByCat[t.category] = (expByCat[t.category] || 0) + t.amount;
    });
    const variances = budgets
      .filter(b => b.type === 'expense' && b.monthly_amount > 0)
      .map(b => ({
        category: b.category,
        budgeted: b.monthly_amount,
        actual: expByCat[b.category] || 0,
        pct: ((expByCat[b.category] || 0) / b.monthly_amount) * 100,
      }))
      .sort((a, b) => b.pct - a.pct);

    // Claims
    const overdueCount = claims.filter(c => c.status === 'overdue' || (c.status === 'pending' && new Date(c.due_date) < now)).length;
    const overdueAmount = claims.filter(c => c.status === 'overdue' || (c.status === 'pending' && new Date(c.due_date) < now)).reduce((s, c) => s + c.amount, 0);
    const pendingAmount = claims.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);

    return {
      kpis: { cur, prev, incTrend, expTrend },
      trendData: Object.values(monthMap),
      budgetVariances: variances,
      claimsStats: { overdueCount, overdueAmount, pendingAmount }
    };
  }, [transactions, budgets, claims]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Inntekter (denne mnd)"
          value={formatNOK(kpis.cur.income)}
          icon={TrendingUp}
          color="green"
          trend={kpis.incTrend}
        />
        <KpiCard
          title="Utgifter (denne mnd)"
          value={formatNOK(kpis.cur.expense)}
          icon={TrendingDown}
          color="red"
          trend={-kpis.expTrend}
          trendLabel="vs forrige mnd (lavere er bedre)"
        />
        <KpiCard
          title="Netto denne mnd"
          value={formatNOK(kpis.cur.income - kpis.cur.expense)}
          icon={Wallet}
          color={kpis.cur.income >= kpis.cur.expense ? 'green' : 'red'}
          sub={kpis.cur.income >= kpis.cur.expense ? 'Positivt resultat' : 'Negativt resultat'}
        />
        <KpiCard
          title="Forfalte krav"
          value={formatNOK(claimsStats.overdueAmount)}
          sub={`${claimsStats.overdueCount} krav forfalt`}
          icon={AlertCircle}
          color="amber"
        />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Inntekter vs utgifter (12 mnd)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    formatter={(val) => [`${new Intl.NumberFormat('nb-NO').format(val)} kr`]}
                  />
                  <Legend verticalAlign="top" height={32} iconType="circle" iconSize={8} />
                  <Area type="monotone" dataKey="inntekter" name="Inntekter" stroke="#10b981" fill="url(#incGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="utgifter" name="Utgifter" stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Netto utvikling (12 mnd)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    formatter={(val) => [`${new Intl.NumberFormat('nb-NO').format(val)} kr`]}
                  />
                  <Line type="monotone" dataKey="netto" name="Netto" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget variances */}
      {budgetVariances.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Budsjettavvik denne måneden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {budgetVariances.slice(0, 6).map(v => (
              <div key={v.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{v.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{formatNOK(v.actual)} / {formatNOK(v.budgeted)}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${v.pct >= 100 ? 'border-red-300 text-red-600' : v.pct >= 80 ? 'border-amber-300 text-amber-600' : 'border-emerald-300 text-emerald-600'}`}
                    >
                      {v.pct.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${v.pct >= 100 ? 'bg-red-500' : v.pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(v.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Claims status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Forfalte krav</p>
              <p className="text-xl font-bold text-red-600">{formatNOK(claimsStats.overdueAmount)}</p>
              <p className="text-xs text-slate-400">{claimsStats.overdueCount} krav forfalt</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Utestående krav (totalt)</p>
              <p className="text-xl font-bold text-amber-600">{formatNOK(claimsStats.pendingAmount)}</p>
              <p className="text-xs text-slate-400">Venter på betaling</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}