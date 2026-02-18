import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Bell, TrendingUp } from 'lucide-react';
import { formatNOK } from '../shared/FormatUtils';
import { Progress } from '@/components/ui/progress';

export default function BudgetDeviationAlerts({ transactions, budgets }) {
  const { alerts, goodCount } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const monthProgress = dayOfMonth / daysInMonth;

    const monthlyActuals = {};
    transactions.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth && t.type === 'expense') {
        monthlyActuals[t.category] = (monthlyActuals[t.category] || 0) + t.amount;
      }
    });

    const all = budgets.filter(b => b.type === 'expense').map(b => {
      const monthlyBudget = b.period === 'monthly' ? b.monthly_amount : (b.yearly_amount || 0) / 12;
      const actual = monthlyActuals[b.category] || 0;
      const projected = monthProgress > 0 ? actual / monthProgress : 0;
      const percentUsed = monthlyBudget > 0 ? (actual / monthlyBudget) * 100 : 0;
      const projectedPercent = monthlyBudget > 0 ? (projected / monthlyBudget) * 100 : 0;

      let status = 'ok';
      if (percentUsed >= 100) status = 'over';
      else if (projectedPercent >= 105) status = 'warning';
      else if (percentUsed >= 80) status = 'caution';

      return {
        category: b.category, monthlyBudget, actual, projected,
        percentUsed, projectedPercent, status,
        daysLeft: daysInMonth - dayOfMonth,
        overshoot: Math.max(0, projected - monthlyBudget),
      };
    });

    return {
      alerts: all.filter(a => a.status !== 'ok').sort((a, b) => b.percentUsed - a.percentUsed),
      goodCount: all.filter(a => a.status === 'ok').length,
    };
  }, [transactions, budgets]);

  if (budgets.filter(b => b.type === 'expense').length === 0) return null;

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            Budsjettadvarsler – inneværende måned
          </CardTitle>
          {goodCount > 0 && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {goodCount} kategorier OK
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 text-emerald-600 py-2">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-medium">Alle budsjetter er innenfor grenser denne måneden! 🎉</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <div key={alert.category} className={`p-4 rounded-lg border ${
                alert.status === 'over'
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  : alert.status === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                  : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${alert.status === 'over' ? 'text-red-600' : 'text-amber-600'}`} />
                    <span className="font-medium text-sm">{alert.category}</span>
                  </div>
                  <Badge className={
                    alert.status === 'over' ? 'bg-red-100 text-red-700 border-0' :
                    alert.status === 'warning' ? 'bg-amber-100 text-amber-700 border-0' :
                    'bg-yellow-100 text-yellow-700 border-0'
                  }>
                    {alert.status === 'over' ? 'Over budsjett' :
                     alert.status === 'warning' ? 'Forventes å overskride' : 'Nærmer seg grense'}
                  </Badge>
                </div>
                <Progress
                  value={Math.min(alert.percentUsed, 100)}
                  className="h-2 mb-3"
                />
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div>Brukt: <span className="font-semibold">{formatNOK(alert.actual)}</span></div>
                  <div>Budsjett: <span className="font-semibold">{formatNOK(alert.monthlyBudget)}</span></div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span className={`font-semibold ${alert.projectedPercent >= 100 ? 'text-red-600' : ''}`}>
                      {formatNOK(alert.projected)}
                    </span>
                  </div>
                </div>
                {alert.overshoot > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Forventet overskridelse: <span className="font-semibold text-red-600">{formatNOK(alert.overshoot)}</span> ({alert.daysLeft} dager igjen av måneden)
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}