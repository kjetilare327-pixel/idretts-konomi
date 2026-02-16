import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];

export default function MonthlyChart({ transactions }) {
  const data = useMemo(() => {
    const monthData = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthData[key] = { name: MONTH_NAMES[d.getMonth()], inntekter: 0, utgifter: 0 };
    }
    transactions.forEach(t => {
      const key = t.date?.substring(0, 7);
      if (monthData[key]) {
        if (t.type === 'income') monthData[key].inntekter += t.amount;
        else monthData[key].utgifter += t.amount;
      }
    });
    return Object.values(monthData);
  }, [transactions]);

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Månedlig oversikt</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                formatter={(val) => [`${new Intl.NumberFormat('nb-NO').format(val)} kr`]}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
              <Bar dataKey="inntekter" name="Inntekter" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="utgifter" name="Utgifter" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}