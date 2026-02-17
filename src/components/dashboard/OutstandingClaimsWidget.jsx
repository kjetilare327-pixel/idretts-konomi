import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNOK } from '@/components/shared/FormatUtils';
import { AlertTriangle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function OutstandingClaimsWidget({ teamId }) {
  const navigate = useNavigate();

  const { data: claims = [] } = useQuery({
    queryKey: ['claims', teamId],
    queryFn: () => base44.entities.Claim.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const claimsSummary = useMemo(() => {
    const now = new Date();
    const pending = claims.filter(c => c.status === 'pending');
    const overdue = claims.filter(c => c.status === 'overdue' || (c.status === 'pending' && new Date(c.due_date) < now));
    
    const totalOutstanding = pending.reduce((sum, c) => sum + c.amount, 0);
    const totalOverdue = overdue.reduce((sum, c) => sum + c.amount, 0);

    return {
      count: pending.length,
      overdue: overdue.length,
      total: totalOutstanding,
      overdueTotal: totalOverdue,
      riskLevel: overdue.length > 5 ? 'high' : overdue.length > 2 ? 'medium' : 'low'
    };
  }, [claims]);

  const getRiskColor = () => {
    if (claimsSummary.riskLevel === 'high') return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900';
    if (claimsSummary.riskLevel === 'medium') return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900';
    return 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900';
  };

  return (
    <Card 
      className={`border-0 shadow-lg cursor-pointer hover:shadow-xl transition-shadow ${getRiskColor()}`}
      onClick={() => navigate(createPageUrl('Players'))}
    >
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          Utestående krav
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-400">Totalt utestående</span>
          <span className="font-bold text-lg">{claimsSummary.count}</span>
        </div>

        <div className={`p-3 rounded-lg ${claimsSummary.riskLevel === 'high' ? 'bg-red-100/50 dark:bg-red-900/30' : claimsSummary.riskLevel === 'medium' ? 'bg-amber-100/50 dark:bg-amber-900/30' : 'bg-emerald-100/50 dark:bg-emerald-900/30'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Forfalt</span>
            <Badge variant="outline" className={
              claimsSummary.riskLevel === 'high' ? 'border-red-600 text-red-600' :
              claimsSummary.riskLevel === 'medium' ? 'border-amber-600 text-amber-600' :
              'border-emerald-600 text-emerald-600'
            }>
              {claimsSummary.overdue} krav
            </Badge>
          </div>
          <p className={`font-bold text-lg ${
            claimsSummary.riskLevel === 'high' ? 'text-red-600' :
            claimsSummary.riskLevel === 'medium' ? 'text-amber-600' :
            'text-emerald-600'
          }`}>
            {formatNOK(claimsSummary.overdueTotal)}
          </p>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-400">
          Samlet beløp: <span className="font-semibold">{formatNOK(claimsSummary.total)}</span>
        </div>

        {claimsSummary.riskLevel === 'high' && (
          <div className="flex items-center gap-2 p-2 bg-red-100/70 dark:bg-red-900/40 rounded text-red-700 dark:text-red-300 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Høy risiko - følg opp medlemmer</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}