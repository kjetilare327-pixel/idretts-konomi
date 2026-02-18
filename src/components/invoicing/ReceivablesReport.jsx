import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileText, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatNOK, formatDate } from '@/components/shared/FormatUtils';

export default function ReceivablesReport({ claims = [], players = [] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const total = claims.filter(c => c.status !== 'cancelled').reduce((s, c) => s + c.amount, 0);
    const paid = claims.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
    const pending = claims.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
    const overdue = claims.filter(c => c.status === 'overdue' || (c.status === 'pending' && c.due_date && new Date(c.due_date) < now)).reduce((s, c) => s + c.amount, 0);
    const collectionRate = total > 0 ? (paid / total) * 100 : 100;

    // Aging buckets for overdue
    const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    claims.filter(c => c.status !== 'paid' && c.status !== 'cancelled' && c.due_date).forEach(c => {
      const days = Math.max(0, Math.floor((now - new Date(c.due_date)) / (1000 * 60 * 60 * 24)));
      if (days <= 30) aging['0-30'] += c.amount;
      else if (days <= 60) aging['31-60'] += c.amount;
      else if (days <= 90) aging['61-90'] += c.amount;
      else aging['90+'] += c.amount;
    });

    // Per member breakdown
    const memberMap = {};
    claims.filter(c => c.status !== 'paid' && c.status !== 'cancelled').forEach(c => {
      const player = players.find(p => p.id === c.player_id);
      const name = player?.full_name || c.player_id || 'Ukjent';
      if (!memberMap[name]) memberMap[name] = { total: 0, overdue: 0, count: 0 };
      memberMap[name].total += c.amount;
      memberMap[name].count++;
      const isOverdue = c.status === 'overdue' || (c.due_date && new Date(c.due_date) < now);
      if (isOverdue) memberMap[name].overdue += c.amount;
    });

    const topDebtors = Object.entries(memberMap)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return { total, paid, pending, overdue, collectionRate, aging, topDebtors };
  }, [claims, players]);

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" />
          <div>
            <CardTitle className="text-base">Utestående fordringer – rapport</CardTitle>
            <CardDescription>Oversikt over betalingsstatus, aldersfordeling og topp skyldnere</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Totale krav</p>
            <p className="font-bold text-sm">{formatNOK(stats.total)}</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Innbetalt</p>
            <p className="font-bold text-sm text-emerald-700">{formatNOK(stats.paid)}</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Utestående</p>
            <p className="font-bold text-sm text-amber-700">{formatNOK(stats.pending)}</p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Forfalt</p>
            <p className="font-bold text-sm text-red-700">{formatNOK(stats.overdue)}</p>
          </div>
        </div>

        {/* Collection rate */}
        <div>
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="flex items-center gap-1 font-medium">
              {stats.collectionRate >= 90 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
              Innkrevingsrate
            </span>
            <span className={`font-bold ${stats.collectionRate >= 90 ? 'text-emerald-600' : stats.collectionRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
              {stats.collectionRate.toFixed(1)}%
            </span>
          </div>
          <Progress value={stats.collectionRate} className="h-2" />
        </div>

        {/* Aging */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Aldersfordeling (dager forfalt)</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(stats.aging).map(([bucket, amount]) => (
              <div key={bucket} className={`p-2 rounded text-center ${
                bucket === '90+' ? 'bg-red-100 dark:bg-red-950/30' :
                bucket === '61-90' ? 'bg-orange-100 dark:bg-orange-950/30' :
                bucket === '31-60' ? 'bg-amber-100 dark:bg-amber-950/30' :
                'bg-slate-100 dark:bg-slate-800'
              }`}>
                <p className="text-xs text-slate-500">{bucket} dg</p>
                <p className="text-xs font-bold">{formatNOK(amount)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top debtors */}
        {stats.topDebtors.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Topp utestående per medlem</p>
            <div className="space-y-2">
              {stats.topDebtors.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-4">{i + 1}.</span>
                    <span className="font-medium text-sm truncate max-w-[150px]">{d.name}</span>
                    <Badge variant="outline" className="text-xs py-0">{d.count} krav</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.overdue > 0 && <span className="text-xs text-red-600 font-medium">{formatNOK(d.overdue)} forfalt</span>}
                    <span className="font-semibold text-sm">{formatNOK(d.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}