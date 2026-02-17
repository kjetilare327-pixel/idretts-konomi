import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatNOK } from '@/components/shared/FormatUtils';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

const COLORS = ['#0891b2', '#06b6d4', '#a78bfa', '#f87171', '#fbbf24', '#34d399'];

export default function FinancialYearlyReport({ teamId, year }) {
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', teamId],
    queryFn: () => base44.entities.Transaction.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', teamId],
    queryFn: () => base44.entities.Budget.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const yearData = useMemo(() => {
    const yearStr = String(year);
    const yearTx = transactions.filter(t => t.date?.startsWith(yearStr));
    
    const monthlyData = {};
    for (let i = 1; i <= 12; i++) {
      const monthStr = `${yearStr}-${String(i).padStart(2, '0')}`;
      monthlyData[monthStr] = { income: 0, expense: 0 };
    }

    yearTx.forEach(tx => {
      const monthKey = tx.date.slice(0, 7);
      if (monthlyData[monthKey]) {
        if (tx.type === 'income') {
          monthlyData[monthKey].income += tx.amount;
        } else {
          monthlyData[monthKey].expense += tx.amount;
        }
      }
    });

    return Object.entries(monthlyData).map(([month, data]) => ({
      month: new Date(month + '-01').toLocaleDateString('nb-NO', { month: 'short' }),
      inntekter: data.income,
      utgifter: data.expense,
      netto: data.income - data.expense
    }));
  }, [transactions, year]);

  const categoryBreakdown = useMemo(() => {
    const yearStr = String(year);
    const yearTx = transactions.filter(t => t.date?.startsWith(yearStr) && t.type === 'expense');
    
    const byCategory = {};
    yearTx.forEach(tx => {
      byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount;
    });

    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, year]);

  const summary = useMemo(() => {
    const yearStr = String(year);
    const yearTx = transactions.filter(t => t.date?.startsWith(yearStr));
    
    const income = yearTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = yearTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = income - expense;

    const budgetExpense = budgets.filter(b => b.type === 'expense').reduce((s, b) => s + (b.yearly_amount || b.monthly_amount * 12), 0);
    const variance = budgetExpense - expense;

    return { income, expense, net, budgetExpense, variance };
  }, [transactions, budgets, year]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total inntekt {year}</p>
                <p className="text-2xl font-bold text-emerald-600">{formatNOK(summary.income)}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-slate-900">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total utgift {year}</p>
                <p className="text-2xl font-bold text-red-600">{formatNOK(summary.expense)}</p>
              </div>
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Netto resultat {year}</p>
                <p className={`text-2xl font-bold ${summary.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatNOK(summary.net)}
                </p>
              </div>
              <DollarSign className="w-6 h-6 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Budsjettavvik utgifter</p>
              <p className={`text-2xl font-bold ${summary.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {summary.variance >= 0 ? '+' : ''}{formatNOK(summary.variance)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {summary.variance >= 0 ? 'Under' : 'Over'} budsjett
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly trend */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Månedlig inntekt og utgifter {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={yearData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatNOK(value)} />
              <Legend />
              <Bar dataKey="inntekter" fill="#10b981" name="Inntekter" />
              <Bar dataKey="utgifter" fill="#ef4444" name="Utgifter" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Utgifter per kategori {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatNOK(value)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNOK(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Detaljert utgiftsfordeling</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryBreakdown.map((cat, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="font-medium">{cat.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatNOK(cat.value)}</p>
                    <p className="text-xs text-slate-500">
                      {summary.expense > 0 ? Math.round((cat.value / summary.expense) * 100) : 0}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}