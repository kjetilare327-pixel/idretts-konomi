import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function YearOverYearChart({ transactions }) {
  const comparisonData = React.useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;
    
    const monthlyData = {};
    
    // Initialiser alle måneder
    for (let i = 0; i < 12; i++) {
      const monthName = new Date(2000, i).toLocaleDateString('nb-NO', { month: 'short' });
      monthlyData[i] = {
        month: monthName,
        [`${currentYear}_income`]: 0,
        [`${currentYear}_expense`]: 0,
        [`${lastYear}_income`]: 0,
        [`${lastYear}_expense`]: 0
      };
    }
    
    // Summer transaksjoner
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const year = date.getFullYear();
      const month = date.getMonth();
      
      if (year === currentYear || year === lastYear) {
        const key = `${year}_${tx.type}`;
        monthlyData[month][key] += tx.amount;
      }
    });
    
    return Object.values(monthlyData);
  }, [transactions]);

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-base">År-over-år sammenligning</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
              className="text-slate-600 dark:text-slate-400"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              className="text-slate-600 dark:text-slate-400"
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
            <Legend />
            <Bar dataKey={`${currentYear}_income`} fill="#10b981" name={`${currentYear} Inntekt`} />
            <Bar dataKey={`${currentYear}_expense`} fill="#ef4444" name={`${currentYear} Utgift`} />
            <Bar dataKey={`${lastYear}_income`} fill="#6ee7b7" name={`${lastYear} Inntekt`} />
            <Bar dataKey={`${lastYear}_expense`} fill="#fca5a5" name={`${lastYear} Utgift`} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}