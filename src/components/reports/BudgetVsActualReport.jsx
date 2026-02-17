import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNOK } from '@/components/shared/FormatUtils';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

export default function BudgetVsActualReport({ transactions, budgets, startDate, endDate }) {
  const analysis = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Filter transactions by period
    const filteredTx = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= start && txDate <= end;
    });
    
    // Calculate months in period
    const monthsDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 30));
    
    // Group by category
    const results = [];
    
    budgets.forEach(budget => {
      const categoryTx = filteredTx.filter(t => 
        t.category === budget.category && t.type === budget.type
      );
      
      const actual = categoryTx.reduce((sum, t) => sum + t.amount, 0);
      const budgeted = budget.period === 'monthly' 
        ? budget.monthly_amount * monthsDiff 
        : budget.yearly_amount * (monthsDiff / 12);
      
      const variance = actual - budgeted;
      const variancePercent = budgeted > 0 ? (variance / budgeted) * 100 : 0;
      
      results.push({
        category: budget.category,
        type: budget.type,
        budgeted,
        actual,
        variance,
        variancePercent,
        status: budget.type === 'expense' 
          ? (actual > budgeted * 1.1 ? 'over' : actual > budgeted ? 'warning' : 'good')
          : (actual < budgeted * 0.9 ? 'under' : actual < budgeted ? 'warning' : 'good')
      });
    });
    
    return results;
  }, [transactions, budgets, startDate, endDate]);

  const totals = useMemo(() => {
    const income = analysis.filter(a => a.type === 'income');
    const expense = analysis.filter(a => a.type === 'expense');
    
    return {
      income: {
        budgeted: income.reduce((s, a) => s + a.budgeted, 0),
        actual: income.reduce((s, a) => s + a.actual, 0)
      },
      expense: {
        budgeted: expense.reduce((s, a) => s + a.budgeted, 0),
        actual: expense.reduce((s, a) => s + a.actual, 0)
      }
    };
  }, [analysis]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Inntekter</div>
            <div className="text-2xl font-bold text-emerald-600">{formatNOK(totals.income.actual)}</div>
            <div className="text-xs text-slate-500">Budsjett: {formatNOK(totals.income.budgeted)}</div>
            <div className={`text-xs font-medium mt-1 ${
              totals.income.actual >= totals.income.budgeted ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {totals.income.actual >= totals.income.budgeted ? '↑' : '↓'} 
              {formatNOK(Math.abs(totals.income.actual - totals.income.budgeted))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Utgifter</div>
            <div className="text-2xl font-bold text-red-600">{formatNOK(totals.expense.actual)}</div>
            <div className="text-xs text-slate-500">Budsjett: {formatNOK(totals.expense.budgeted)}</div>
            <div className={`text-xs font-medium mt-1 ${
              totals.expense.actual <= totals.expense.budgeted ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {totals.expense.actual <= totals.expense.budgeted ? '↓' : '↑'} 
              {formatNOK(Math.abs(totals.expense.actual - totals.expense.budgeted))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Netto resultat</div>
            <div className={`text-2xl font-bold ${
              (totals.income.actual - totals.expense.actual) >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {formatNOK(totals.income.actual - totals.expense.actual)}
            </div>
            <div className="text-xs text-slate-500">
              Budsjett: {formatNOK(totals.income.budgeted - totals.expense.budgeted)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Detaljert analyse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analysis.map((item, idx) => (
              <div key={idx} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-900">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{item.category}</h4>
                      <Badge variant="outline" className="text-xs">
                        {item.type === 'income' ? 'Inntekt' : 'Utgift'}
                      </Badge>
                      {item.status === 'over' && (
                        <Badge className="bg-red-100 text-red-700 text-xs gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Over budsjett
                        </Badge>
                      )}
                      {item.status === 'under' && (
                        <Badge className="bg-amber-100 text-amber-700 text-xs gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Under budsjett
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm mt-2">
                      <div>
                        <span className="text-slate-500">Budsjett:</span>
                        <span className="font-medium ml-2">{formatNOK(item.budgeted)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Faktisk:</span>
                        <span className="font-medium ml-2">{formatNOK(item.actual)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Avvik:</span>
                        <span className={`font-medium ml-2 ${
                          item.variance >= 0 
                            ? (item.type === 'income' ? 'text-emerald-600' : 'text-red-600')
                            : (item.type === 'income' ? 'text-red-600' : 'text-emerald-600')
                        }`}>
                          {item.variance >= 0 ? '+' : ''}{formatNOK(item.variance)} ({item.variancePercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <Progress 
                  value={Math.min((item.actual / item.budgeted) * 100, 100)} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}