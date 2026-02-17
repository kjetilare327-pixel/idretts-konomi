import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatNOK } from '@/components/shared/FormatUtils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function CashFlowProjection({ transactions, claims, budgets }) {
  const projection = useMemo(() => {
    const today = new Date();
    const months = [];
    
    // Calculate historical average for the past 6 months
    const historicalMonths = 6;
    const historicalData = [];
    
    for (let i = historicalMonths; i > 0; i--) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const monthTx = transactions.filter(t => t.date?.startsWith(monthKey));
      const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      
      historicalData.push({ income, expense, net: income - expense });
    }
    
    // Calculate averages
    const avgIncome = historicalData.reduce((s, d) => s + d.income, 0) / historicalMonths;
    const avgExpense = historicalData.reduce((s, d) => s + d.expense, 0) / historicalMonths;
    
    // Current balance
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    let runningBalance = totalIncome - totalExpense;
    
    // Project next 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(today);
      date.setMonth(date.getMonth() + i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Use budget if available, otherwise use historical average
      const budgetIncome = budgets
        .filter(b => b.type === 'income')
        .reduce((s, b) => s + (b.monthly_amount || 0), 0);
      const budgetExpense = budgets
        .filter(b => b.type === 'expense')
        .reduce((s, b) => s + (b.monthly_amount || 0), 0);
      
      const projectedIncome = budgetIncome > 0 ? budgetIncome : avgIncome;
      const projectedExpense = budgetExpense > 0 ? budgetExpense : avgExpense;
      
      // Add expected claims
      const monthClaims = claims.filter(c => {
        const dueDate = new Date(c.due_date);
        return dueDate.getMonth() === date.getMonth() && 
               dueDate.getFullYear() === date.getFullYear() &&
               c.status === 'pending';
      });
      const claimsAmount = monthClaims.reduce((s, c) => s + c.amount, 0);
      
      runningBalance = runningBalance + projectedIncome + claimsAmount - projectedExpense;
      
      months.push({
        month: date.toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' }),
        income: projectedIncome + claimsAmount,
        expense: projectedExpense,
        net: projectedIncome + claimsAmount - projectedExpense,
        balance: runningBalance,
        isCritical: runningBalance < 0
      });
    }
    
    return { months, avgIncome, avgExpense };
  }, [transactions, claims, budgets]);

  const criticalMonths = projection.months.filter(m => m.isCritical);

  return (
    <div className="space-y-6">
      {criticalMonths.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                  Advarsel: Negativ saldo forventet
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Prognosen viser negativ saldo i {criticalMonths.length} måned{criticalMonths.length > 1 ? 'er' : ''}: 
                  {criticalMonths.slice(0, 3).map(m => ` ${m.month}`).join(',')}
                  {criticalMonths.length > 3 && '...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cashflow-prognose (12 måneder)</CardTitle>
          <CardDescription>
            Basert på historiske data og budsjett
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection.months}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value) => formatNOK(value)}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  stackId="1"
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.6}
                  name="Inntekter"
                />
                <Area 
                  type="monotone" 
                  dataKey="expense" 
                  stackId="2"
                  stroke="#ef4444" 
                  fill="#ef4444" 
                  fillOpacity={0.6}
                  name="Utgifter"
                />
                <Line 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  name="Saldo"
                  dot={{ fill: '#6366f1', r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gjennomsnitt per måned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Inntekter</span>
                <span className="font-semibold text-emerald-600">{formatNOK(projection.avgIncome)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">Utgifter</span>
                <span className="font-semibold text-red-600">{formatNOK(projection.avgExpense)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Netto</span>
                <span className={`font-bold ${
                  projection.avgIncome - projection.avgExpense >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {formatNOK(projection.avgIncome - projection.avgExpense)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forventet saldo om 12 mnd</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className={`text-4xl font-bold mb-2 ${
                projection.months[11]?.balance >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {formatNOK(projection.months[11]?.balance || 0)}
              </div>
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className={`w-5 h-5 ${
                  projection.months[11]?.balance >= projection.months[0]?.balance 
                    ? 'text-emerald-500' 
                    : 'text-red-500'
                }`} />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {projection.months[11]?.balance >= projection.months[0]?.balance ? 'Positiv' : 'Negativ'} utvikling
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}