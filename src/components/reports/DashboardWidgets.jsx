import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNOK } from '@/components/shared/FormatUtils';
import {
  TrendingUp, TrendingDown, DollarSign, Users, AlertCircle, CheckCircle2,
  BarChart2, PieChart as PieChartIcon, Activity, GripVertical, X, Plus, Settings2
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

const ALL_WIDGETS = [
  { id: 'net_balance', label: 'Nettoresultat', icon: DollarSign, size: 'sm' },
  { id: 'total_income', label: 'Totale inntekter', icon: TrendingUp, size: 'sm' },
  { id: 'total_expense', label: 'Totale utgifter', icon: TrendingDown, size: 'sm' },
  { id: 'overdue_claims', label: 'Forfalte krav', icon: AlertCircle, size: 'sm' },
  { id: 'member_count', label: 'Antall medlemmer', icon: Users, size: 'sm' },
  { id: 'collection_rate', label: 'Innkrevingsrate', icon: CheckCircle2, size: 'sm' },
  { id: 'monthly_trend', label: 'Månedlig trend', icon: Activity, size: 'lg' },
  { id: 'expense_pie', label: 'Utgiftsfordeling', icon: PieChartIcon, size: 'md' },
  { id: 'income_bar', label: 'Inntekter per kategori', icon: BarChart2, size: 'md' },
  { id: 'cashflow_area', label: 'Kumulativ kontantstrøm', icon: Activity, size: 'lg' },
];

const DEFAULT_ACTIVE = ['net_balance', 'total_income', 'total_expense', 'overdue_claims', 'monthly_trend', 'expense_pie'];

function StatWidget({ widget, data }) {
  const iconMap = { net_balance: DollarSign, total_income: TrendingUp, total_expense: TrendingDown, overdue_claims: AlertCircle, member_count: Users, collection_rate: CheckCircle2 };
  const Icon = iconMap[widget.id] || DollarSign;

  const configs = {
    net_balance: { label: 'Nettoresultat', value: formatNOK(data.balance), color: data.balance >= 0 ? 'text-emerald-600' : 'text-red-600', bg: data.balance >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20', iconColor: data.balance >= 0 ? 'text-emerald-400' : 'text-red-400' },
    total_income: { label: 'Totale inntekter', value: formatNOK(data.totalIncome), color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-400' },
    total_expense: { label: 'Totale utgifter', value: formatNOK(data.totalExpense), color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', iconColor: 'text-red-400' },
    overdue_claims: { label: 'Forfalte krav', value: formatNOK(data.overdueAmount), color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', iconColor: 'text-red-400', sub: `${data.overdueCount} krav` },
    member_count: { label: 'Aktive medlemmer', value: data.memberCount, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-400' },
    collection_rate: { label: 'Innkrevingsrate', value: `${data.collectionRate}%`, color: data.collectionRate >= 70 ? 'text-emerald-600' : 'text-amber-600', bg: data.collectionRate >= 70 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20', iconColor: 'text-emerald-400' },
  };

  const cfg = configs[widget.id];
  if (!cfg) return null;

  return (
    <Card className="border-0 shadow-sm dark:bg-slate-900 h-full">
      <CardContent className="p-5">
        <div className={`flex items-start justify-between`}>
          <div>
            <p className="text-xs text-slate-500 mb-1">{cfg.label}</p>
            <p className={`text-2xl font-bold ${cfg.color}`}>{cfg.value}</p>
            {cfg.sub && <p className="text-xs text-slate-400 mt-1">{cfg.sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${cfg.bg}`}>
            <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartWidget({ widget, data }) {
  if (widget.id === 'monthly_trend') {
    return (
      <Card className="border-0 shadow-sm dark:bg-slate-900 h-full">
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Månedlig trend</CardTitle></CardHeader>
        <CardContent className="px-2 pb-4">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={40} />
                <Tooltip formatter={v => formatNOK(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name="Inntekt" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="expense" name="Utgift" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (widget.id === 'expense_pie') {
    return (
      <Card className="border-0 shadow-sm dark:bg-slate-900 h-full">
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Utgiftsfordeling</CardTitle></CardHeader>
        <CardContent className="px-2 pb-4">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, percent }) => percent > 0.05 ? `${(percent*100).toFixed(0)}%` : ''} labelLine={false}>
                  {data.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatNOK(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (widget.id === 'income_bar') {
    return (
      <Card className="border-0 shadow-sm dark:bg-slate-900 h-full">
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Inntekter per kategori</CardTitle></CardHeader>
        <CardContent className="px-2 pb-4">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.incomeCatData} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={v => formatNOK(v)} />
                <Bar dataKey="value" name="Beløp" fill="#10b981" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (widget.id === 'cashflow_area') {
    return (
      <Card className="border-0 shadow-sm dark:bg-slate-900 h-full">
        <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Kumulativ kontantstrøm</CardTitle></CardHeader>
        <CardContent className="px-2 pb-4">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.cumulativeCashflow}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={45} />
                <Tooltip formatter={v => formatNOK(v)} />
                <Area type="monotone" dataKey="cumulative" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} name="Kumulativ" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

export default function DashboardWidgets({ transactions, claims, budgets, players }) {
  const [activeWidgets, setActiveWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem('report_widgets');
      return saved ? JSON.parse(saved) : DEFAULT_ACTIVE;
    } catch { return DEFAULT_ACTIVE; }
  });
  const [editMode, setEditMode] = useState(false);

  const saveWidgets = (w) => {
    setActiveWidgets(w);
    localStorage.setItem('report_widgets', JSON.stringify(w));
  };

  const removeWidget = (id) => saveWidgets(activeWidgets.filter(w => w !== id));
  const addWidget = (id) => { if (!activeWidgets.includes(id)) saveWidgets([...activeWidgets, id]); };

  // Compute data
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const overdueAmount = claims.filter(c => c.status === 'overdue').reduce((s, c) => s + c.amount, 0);
  const overdueCount = claims.filter(c => c.status === 'overdue').length;
  const paidAmount = claims.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const totalClaimsAmount = claims.reduce((s, c) => s + c.amount, 0);
  const collectionRate = totalClaimsAmount > 0 ? Math.round((paidAmount / totalClaimsAmount) * 100) : 0;

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des'];
  const monthlyMap = {};
  transactions.forEach(t => {
    if (!t.date) return;
    const m = new Date(t.date).getMonth();
    if (!monthlyMap[m]) monthlyMap[m] = { month: MONTHS_SHORT[m], income: 0, expense: 0 };
    if (t.type === 'income') monthlyMap[m].income += t.amount;
    else monthlyMap[m].expense += t.amount;
  });
  const monthlyTrend = Object.values(monthlyMap).sort((a, b) => MONTHS_SHORT.indexOf(a.month) - MONTHS_SHORT.indexOf(b.month));

  const expenseByCat = {};
  transactions.filter(t => t.type === 'expense').forEach(t => { expenseByCat[t.category] = (expenseByCat[t.category] || 0) + t.amount; });
  const pieData = Object.entries(expenseByCat).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6);

  const incomeByCat = {};
  transactions.filter(t => t.type === 'income').forEach(t => { incomeByCat[t.category] = (incomeByCat[t.category] || 0) + t.amount; });
  const incomeCatData = Object.entries(incomeByCat).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6);

  let cumulative = 0;
  const cumulativeCashflow = monthlyTrend.map(m => {
    cumulative += (m.income - m.expense);
    return { month: m.month, cumulative };
  });

  const data = {
    balance: totalIncome - totalExpense,
    totalIncome, totalExpense, overdueAmount, overdueCount,
    memberCount: players.filter(p => p.status === 'active').length,
    collectionRate,
    monthlyTrend, pieData, incomeCatData, cumulativeCashflow
  };

  const smWidgets = activeWidgets.filter(id => ALL_WIDGETS.find(w => w.id === id)?.size === 'sm');
  const lgWidgets = activeWidgets.filter(id => ALL_WIDGETS.find(w => w.id === id)?.size !== 'sm');
  const inactiveWidgets = ALL_WIDGETS.filter(w => !activeWidgets.includes(w.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Tilpasset dashboard</h2>
        <div className="flex items-center gap-2">
          {inactiveWidgets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                  <Plus className="w-3.5 h-3.5" /> Legg til widget
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {inactiveWidgets.map(w => (
                  <DropdownMenuItem key={w.id} onClick={() => addWidget(w.id)}>
                    {w.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button size="sm" variant={editMode ? 'default' : 'outline'} className="gap-1.5 text-xs h-8"
            onClick={() => setEditMode(!editMode)}>
            <Settings2 className="w-3.5 h-3.5" />
            {editMode ? 'Ferdig' : 'Rediger'}
          </Button>
        </div>
      </div>

      {/* Stat widgets */}
      {smWidgets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {smWidgets.map(id => {
            const w = ALL_WIDGETS.find(x => x.id === id);
            if (!w) return null;
            return (
              <div key={id} className="relative">
                <StatWidget widget={w} data={data} />
                {editMode && (
                  <button onClick={() => removeWidget(id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 z-10">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Chart widgets */}
      {lgWidgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {lgWidgets.map(id => {
            const w = ALL_WIDGETS.find(x => x.id === id);
            if (!w) return null;
            const isLg = w.size === 'lg';
            return (
              <div key={id} className={`relative ${isLg ? 'lg:col-span-2' : ''}`}>
                <ChartWidget widget={w} data={data} />
                {editMode && (
                  <button onClick={() => removeWidget(id)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 z-10">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeWidgets.length === 0 && (
        <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-xl">
          <p className="text-sm">Ingen widgets. Klikk "Legg til widget" for å bygge dashboardet ditt.</p>
        </div>
      )}
    </div>
  );
}