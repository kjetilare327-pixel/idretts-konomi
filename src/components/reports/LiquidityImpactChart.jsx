import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LiquidityImpactChart({ transactions, budgets }) {
  const liquidityData = React.useMemo(() => {
    // Grupper transaksjoner per måned
    const monthlyData = {};
    const now = new Date();
    
    // Lag data for siste 12 måneder
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = { 
        month: d.toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' }),
        income: 0, 
        expense: 0,
        budgetedExpense: 0
      };
    }
    
    // Summer faktiske transaksjoner
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        if (tx.type === 'income') {
          monthlyData[key].income += tx.amount;
        } else {
          monthlyData[key].expense += tx.amount;
        }
      }
    });
    
    // Legg til budsjetert utgift
    const totalMonthlyBudget = budgets
      .filter(b => b.type === 'expense')
      .reduce((sum, b) => sum + (b.monthly_amount || 0), 0);
    
    Object.keys(monthlyData).forEach(key => {
      monthlyData[key].budgetedExpense = totalMonthlyBudget;
    });
    
    // Beregn kumulativ likviditet
    let cumulative = 0;
    return Object.values(monthlyData).map(d => {
      const net = d.income - d.expense;
      const budgetVariance = d.budgetedExpense - d.expense;
      cumulative += net;
      
      return {
        month: d.month,
        likviditet: cumulative,
        budsjettavvik: budgetVariance,
        påvirkning: cumulative + budgetVariance
      };
    });
  }, [transactions, budgets]);

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-base">Budsjettavvikenes påvirkning på likviditet</CardTitle>
        <CardDescription>Hvordan avvik fra budsjett påvirker total likviditet</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={liquidityData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
              className="text-slate-600 dark:text-slate-400"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              className="text-slate-600 dark:text-slate-400"
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value) => `${value.toLocaleString('nb-NO')} kr`}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <Line 
              type="monotone" 
              dataKey="likviditet" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Faktisk likviditet"
              dot={{ fill: '#10b981' }}
            />
            <Line 
              type="monotone" 
              dataKey="påvirkning" 
              stroke="#f59e0b" 
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Med budsjettavvik"
              dot={{ fill: '#f59e0b' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}