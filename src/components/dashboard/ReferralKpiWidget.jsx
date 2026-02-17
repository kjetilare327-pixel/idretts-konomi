import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, Gift, Target } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function ReferralKpiWidget({ teamId }) {
  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', teamId],
    queryFn: () => base44.entities.Referral.filter({ team_id: teamId }),
    enabled: !!teamId,
  });

  const kpis = useMemo(() => {
    const totalReferrals = referrals.length;
    const activeReferrers = new Set(referrals.map(r => r.referrer_player_id)).size;
    const completedReferrals = referrals.filter(r => r.status === 'completed' || r.status === 'rewarded').length;
    const conversionRate = totalReferrals > 0 ? (completedReferrals / totalReferrals * 100).toFixed(1) : 0;
    const totalRewards = referrals
      .filter(r => r.reward_applied)
      .reduce((sum, r) => sum + (r.reward_amount || 0), 0);

    return {
      totalReferrals,
      activeReferrers,
      completedReferrals,
      conversionRate,
      totalRewards
    };
  }, [referrals]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Henvisningsprogram - KPIer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Aktive henvisere</p>
            <p className="text-2xl font-bold">{kpis.activeReferrers}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Totalt henvisninger</p>
            <p className="text-2xl font-bold">{kpis.totalReferrals}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Konvertering</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-emerald-600">{kpis.conversionRate}%</p>
              {kpis.conversionRate > 50 && <TrendingUp className="w-4 h-4 text-emerald-500" />}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Belønninger</p>
            <p className="text-xl font-bold text-purple-600">{formatNOK(kpis.totalRewards)}</p>
          </div>
        </div>

        {kpis.conversionRate > 60 && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                Høy konvertering! Henvisningsprogrammet fungerer godt 🎉
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}