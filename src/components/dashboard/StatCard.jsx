import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendLabel, variant = 'default' }) {
  const colors = {
    default: 'from-slate-500 to-slate-600',
    green: 'from-emerald-500 to-emerald-600',
    red: 'from-red-500 to-red-600',
    blue: 'from-blue-500 to-blue-600',
  };

  return (
    <Card className="relative overflow-hidden border-0 shadow-md dark:bg-slate-900">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[variant]} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-3 text-xs">
            {trend >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            )}
            <span className={trend >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
            <span className="text-slate-400 ml-1">{trendLabel || 'vs forrige mnd'}</span>
          </div>
        )}
      </div>
    </Card>
  );
}