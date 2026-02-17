import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MembershipTrendChart({ players }) {
  // Grupper spillere etter opprettelsesmåned
  const membershipData = React.useMemo(() => {
    const monthCounts = {};
    
    players.forEach(player => {
      const date = new Date(player.created_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
    });
    
    // Sorter etter dato og beregn kumulativ sum
    const sorted = Object.entries(monthCounts)
      .sort((a, b) => a[0].localeCompare(b[0]));
    
    let cumulative = 0;
    return sorted.map(([month, count]) => {
      cumulative += count;
      const [year, m] = month.split('-');
      const monthName = new Date(year, parseInt(m) - 1).toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' });
      return {
        month: monthName,
        nye: count,
        totalt: cumulative
      };
    });
  }, [players]);

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-base">Medlemsutvikling over tid</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={membershipData}>
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
            />
            <Line 
              type="monotone" 
              dataKey="totalt" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Totalt medlemmer"
              dot={{ fill: '#10b981' }}
            />
            <Line 
              type="monotone" 
              dataKey="nye" 
              stroke="#6366f1" 
              strokeWidth={2}
              name="Nye medlemmer"
              dot={{ fill: '#6366f1' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}