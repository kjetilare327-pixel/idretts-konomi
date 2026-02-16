import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNOK } from '@/components/shared/FormatUtils';

const COLORS = ['#ef4444', '#f97316', '#eab308'];

export default function TopExpenses({ transactions }) {
  const top3 = useMemo(() => {
    const cats = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      cats[t.category] = (cats[t.category] || 0) + t.amount;
    });
    return Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, amount], i) => ({ category: cat, amount, color: COLORS[i] }));
  }, [transactions]);

  if (top3.length === 0) return null;
  const maxAmount = top3[0]?.amount || 1;

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Topp 3 utgifter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {top3.map((item, i) => (
          <div key={item.category} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-medium">{item.category}</span>
              </div>
              <span className="font-semibold">{formatNOK(item.amount)}</span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(item.amount / maxAmount) * 100}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}