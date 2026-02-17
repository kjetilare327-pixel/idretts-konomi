import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Gift, Users, DollarSign, Share2, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { formatNOK, formatDate } from '@/components/shared/FormatUtils';

export default function ReferralDashboard({ player, teamId }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', player?.id],
    queryFn: () => base44.entities.Referral.filter({ 
      team_id: teamId,
      referrer_player_id: player.id 
    }),
    enabled: !!player && !!teamId,
  });

  const referralCode = player?.referral_code || generateReferralCode(player?.full_name);

  const stats = useMemo(() => {
    return {
      total: referrals.length,
      pending: referrals.filter(r => r.status === 'pending').length,
      completed: referrals.filter(r => r.status === 'completed' || r.status === 'rewarded').length,
      totalRewards: referrals
        .filter(r => r.reward_applied)
        .reduce((sum, r) => sum + (r.reward_amount || 0), 0)
    };
  }, [referrals]);

  const generateReferralCode = (name) => {
    if (!name) return '';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${initials}${random}`;
  };

  const saveReferralCode = async () => {
    if (!player?.referral_code) {
      await base44.entities.Player.update(player.id, {
        referral_code: referralCode
      });
      queryClient.invalidateQueries({ queryKey: ['players'] });
    }
  };

  const copyToClipboard = async () => {
    const url = `${window.location.origin}${window.location.pathname}?ref=${referralCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl = `${window.location.origin}${window.location.pathname}?ref=${referralCode}`;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Totalt henvist</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-indigo-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Venter</p>
                <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Fullført</p>
                <p className="text-3xl font-bold text-emerald-600">{stats.completed}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Belønninger</p>
                <p className="text-2xl font-bold text-purple-600">{formatNOK(stats.totalRewards)}</p>
              </div>
              <Gift className="w-8 h-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Din henvisningskode
          </CardTitle>
          <CardDescription>
            Del denne koden med venner og få belønning når de blir medlemmer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={referralCode}
                readOnly
                className="text-2xl font-mono font-bold text-center tracking-widest"
              />
            </div>
            <Button onClick={copyToClipboard} className="gap-2">
              <Copy className="w-4 h-4" />
              {copied ? 'Kopiert!' : 'Kopier'}
            </Button>
          </div>

          <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900">
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
              <strong>Slik fungerer det:</strong>
            </p>
            <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-decimal list-inside">
              <li>Del din henvisningskode med venner</li>
              <li>De bruker koden når de registrerer seg</li>
              <li>Du får rabatt når de betaler sin første kontingent</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Del direkte:</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://wa.me/?text=Bli med i ${teamId}! Bruk koden ${referralCode}: ${shareUrl}`, '_blank')}
                className="gap-2"
              >
                <span>💬</span> WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`mailto:?subject=Bli med i laget&body=Bruk koden ${referralCode} når du registrerer deg: ${shareUrl}`, '_blank')}
                className="gap-2"
              >
                <span>✉️</span> E-post
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')}
                className="gap-2"
              >
                <span>📘</span> Facebook
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral list */}
      {referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mine henvisninger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referrals.map(ref => (
                <div key={ref.id} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-900">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{ref.referred_name || 'Ny medlem'}</h4>
                      <p className="text-sm text-slate-500">
                        Registrert: {formatDate(ref.created_date)}
                      </p>
                      {ref.completed_at && (
                        <p className="text-sm text-emerald-600">
                          Fullført: {formatDate(ref.completed_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={
                        ref.status === 'rewarded' ? 'bg-emerald-100 text-emerald-700' :
                        ref.status === 'completed' ? 'bg-indigo-100 text-indigo-700' :
                        ref.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }>
                        {ref.status === 'rewarded' ? '🎁 Belønnet' :
                         ref.status === 'completed' ? '✓ Fullført' :
                         ref.status === 'pending' ? '⏳ Venter' : ref.status}
                      </Badge>
                      {ref.reward_amount && (
                        <span className="text-sm font-medium text-purple-600">
                          {formatNOK(ref.reward_amount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {referrals.length === 0 && (
        <Alert>
          <TrendingUp className="w-4 h-4" />
          <AlertDescription>
            Du har ikke henvist noen ennå. Begynn å dele din kode for å tjene belønninger!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}