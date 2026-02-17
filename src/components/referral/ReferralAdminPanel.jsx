import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Gift, DollarSign, FileDown, TrendingUp } from 'lucide-react';
import { formatNOK, formatDate } from '@/components/shared/FormatUtils';

export default function ReferralAdminPanel({ teamId }) {
  const queryClient = useQueryClient();

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', teamId],
    queryFn: () => base44.entities.Referral.filter({ team_id: teamId }),
    enabled: !!teamId,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
    enabled: !!teamId,
  });

  const stats = useMemo(() => {
    const totalReferrals = referrals.length;
    const completedReferrals = referrals.filter(r => r.status === 'completed' || r.status === 'rewarded').length;
    const pendingReferrals = referrals.filter(r => r.status === 'pending').length;
    const totalRewardsGiven = referrals
      .filter(r => r.reward_applied)
      .reduce((sum, r) => sum + (r.reward_amount || 0), 0);
    
    // Top referrers
    const referrerCounts = {};
    referrals.forEach(r => {
      referrerCounts[r.referrer_player_id] = (referrerCounts[r.referrer_player_id] || 0) + 1;
    });
    
    const topReferrers = Object.entries(referrerCounts)
      .map(([playerId, count]) => ({
        playerId,
        name: referrals.find(r => r.referrer_player_id === playerId)?.referrer_name,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      totalRewardsGiven,
      conversionRate: totalReferrals > 0 ? (completedReferrals / totalReferrals * 100).toFixed(1) : 0,
      topReferrers
    };
  }, [referrals]);

  const applyReward = async (referralId, rewardType, rewardAmount) => {
    const referral = referrals.find(r => r.id === referralId);
    if (!referral) return;

    await base44.entities.Referral.update(referralId, {
      status: 'rewarded',
      reward_type: rewardType,
      reward_amount: rewardAmount,
      reward_applied: true,
      rewarded_at: new Date().toISOString()
    });

    // Apply discount to referrer's balance
    const referrer = players.find(p => p.id === referral.referrer_player_id);
    if (referrer && rewardType === 'membership_discount') {
      await base44.entities.Player.update(referrer.id, {
        balance: (referrer.balance || 0) - rewardAmount
      });
    }

    queryClient.invalidateQueries({ queryKey: ['referrals'] });
    queryClient.invalidateQueries({ queryKey: ['players'] });
  };

  const exportReport = () => {
    let csv = 'Henviser,Henvist medlem,Status,Belønningstype,Beløp,Dato registrert,Dato fullført\n';
    referrals.forEach(r => {
      csv += `${r.referrer_name},${r.referred_name || 'Ikke registrert'},${r.status},${r.reward_type || 'Ingen'},${r.reward_amount || 0},${formatDate(r.created_date)},${r.completed_at ? formatDate(r.completed_at) : ''}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `henvisningsprogram_rapport_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Totalt henvisninger</div>
            <div className="text-3xl font-bold">{stats.totalReferrals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Fullført</div>
            <div className="text-3xl font-bold text-emerald-600">{stats.completedReferrals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Venter</div>
            <div className="text-3xl font-bold text-amber-600">{stats.pendingReferrals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Konverteringsrate</div>
            <div className="text-3xl font-bold text-indigo-600">{stats.conversionRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500 mb-1">Gitt belønninger</div>
            <div className="text-2xl font-bold text-purple-600">{formatNOK(stats.totalRewardsGiven)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top referrers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Topp henvisere
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.topReferrers.map((ref, idx) => (
              <div key={ref.playerId} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-slate-300">#{idx + 1}</span>
                  <span className="font-medium">{ref.name}</span>
                </div>
                <Badge className="bg-indigo-100 text-indigo-700">
                  {ref.count} henvisning{ref.count !== 1 ? 'er' : ''}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={exportReport} className="gap-2">
          <FileDown className="w-4 h-4" />
          Eksporter rapport
        </Button>
      </div>

      {/* Referrals table */}
      <Card>
        <CardHeader>
          <CardTitle>Alle henvisninger</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Henviser</TableHead>
                <TableHead>Henvist medlem</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Belønning</TableHead>
                <TableHead>Registrert</TableHead>
                <TableHead>Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.map(ref => (
                <TableRow key={ref.id}>
                  <TableCell className="font-medium">{ref.referrer_name}</TableCell>
                  <TableCell>{ref.referred_name || 'Ikke registrert'}</TableCell>
                  <TableCell>
                    <code className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">
                      {ref.referral_code}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      ref.status === 'rewarded' ? 'bg-emerald-100 text-emerald-700' :
                      ref.status === 'completed' ? 'bg-indigo-100 text-indigo-700' :
                      ref.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }>
                      {ref.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ref.reward_applied ? (
                      <span className="text-emerald-600 font-medium">
                        {formatNOK(ref.reward_amount)}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {formatDate(ref.created_date)}
                  </TableCell>
                  <TableCell>
                    {ref.status === 'completed' && !ref.reward_applied && (
                      <Button
                        size="sm"
                        onClick={() => applyReward(ref.id, 'membership_discount', 200)}
                        className="gap-2"
                      >
                        <Gift className="w-4 h-4" />
                        Gi belønning
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}