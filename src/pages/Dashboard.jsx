import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTeam } from '@/components/shared/TeamContext';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatNOK } from '@/components/shared/FormatUtils';
import { Wallet, TrendingUp, TrendingDown, AlertCircle, ArrowRight, Loader2, Receipt, UserCircle, CreditCard, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import StatCard from '@/components/dashboard/StatCard';
import SubscriptionBanner from '@/components/dashboard/SubscriptionBanner';
import ProfileCompletionPrompt from '@/components/onboarding/ProfileCompletionPrompt';
import SetupProgress, { getCompletedSteps, isSetupComplete } from '@/components/onboarding/SetupProgress';
import PullToRefresh from '@/components/mobile/PullToRefresh';

export default function Dashboard() {
  const { currentTeam, teams, loading: teamLoading, isTeamAdmin, playerProfile, refreshPlayerProfile } = useTeam();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = isTeamAdmin();
  const [showProfilePrompt, setShowProfilePrompt] = useState(true);
  const [showSetup, setShowSetup] = useState(true);

  const CACHE_5MIN = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 };

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id }, '-date'),
    enabled: !!currentTeam,
    ...CACHE_5MIN,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims', currentTeam?.id],
    queryFn: () => base44.entities.Claim.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam && isAdmin,
    ...CACHE_5MIN,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', currentTeam?.id],
    queryFn: () => base44.entities.Player.filter({ team_id: currentTeam.id, status: 'active' }),
    enabled: !!currentTeam && isAdmin,
    ...CACHE_5MIN,
  });

  const { data: sentMessages = [] } = useQuery({
    queryKey: ['sent-messages-setup', currentTeam?.id],
    queryFn: () => base44.entities.SentMessage.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam && isAdmin,
    ...CACHE_5MIN,
  });

  const completedSteps = useMemo(
    () => getCompletedSteps(players, transactions, claims, sentMessages),
    [players, transactions, claims, sentMessages]
  );
  const setupComplete = isSetupComplete(completedSteps);

  const stats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = totalIncome - totalExpense;

    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthIncome = transactions.filter(t => t.type === 'income' && t.date?.startsWith(curMonth)).reduce((s, t) => s + t.amount, 0);
    const monthExpense = transactions.filter(t => t.type === 'expense' && t.date?.startsWith(curMonth)).reduce((s, t) => s + t.amount, 0);

    return { balance, monthIncome, monthExpense };
  }, [transactions]);

  const unpaidClaims = useMemo(() =>
    claims
      .filter(c => c.status === 'pending' || c.status === 'overdue')
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 5),
    [claims]
  );

  const totalOutstanding = useMemo(() =>
    claims.filter(c => c.status === 'pending' || c.status === 'overdue').reduce((s, c) => s + c.amount, 0),
    [claims]
  );

  // AuthGate guarantees teams exist before Dashboard renders — this is just a safety net
  if (teamLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions', currentTeam?.id] }),
      queryClient.invalidateQueries({ queryKey: ['claims', currentTeam?.id] }),
      queryClient.invalidateQueries({ queryKey: ['players', currentTeam?.id] }),
    ]);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">{currentTeam?.name} – {isAdmin ? 'Økonomisk oversikt' : 'Min økonomi'}</p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate(createPageUrl('Transactions'))} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            Ny transaksjon <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Profile completion prompt */}
      {playerProfile && showProfilePrompt && (!playerProfile.phone || !playerProfile.notes) && (
        <ProfileCompletionPrompt
          player={playerProfile}
          onComplete={() => { setShowProfilePrompt(false); refreshPlayerProfile(); }}
          onDismiss={() => setShowProfilePrompt(false)}
        />
      )}

      {isAdmin && <SubscriptionBanner team={currentTeam} />}

      {/* Non-admin: empty state with role info + next steps */}
      {!isAdmin && !playerProfile && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <UserCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-lg">{currentTeam?.name || 'Laget ditt'}</p>
              <Badge variant="secondary" className="mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">
                {currentTeamRole === 'forelder' ? 'Forelder' : currentTeamRole === 'player' ? 'Spiller' : currentTeamRole}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 max-w-xs">
              Du er registrert i laget. Administratoren din vil knytte deg til en spillerprofil og du vil se betalingsinformasjon her.
            </p>
            <Link to={createPageUrl('PaymentPortal')}>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2 min-h-[44px]">
                <CreditCard className="w-4 h-4" /> Mine betalinger
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Player balance card */}
      {!isAdmin && playerProfile && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserCircle className="w-5 h-5 text-slate-400" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{currentTeam?.name}</p>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 text-xs">
                {currentTeamRole === 'forelder' ? 'Forelder' : currentTeamRole === 'player' ? 'Spiller' : currentTeamRole}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Din saldo</p>
                <div className="flex items-center gap-2 mt-1">
                  {playerProfile.balance === 0
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    : <AlertCircle className="w-5 h-5 text-red-500" />
                  }
                  <p className={`text-2xl font-bold ${playerProfile.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {playerProfile.balance > 0
                      ? `Skylder ${formatNOK(playerProfile.balance)}`
                      : playerProfile.balance < 0
                      ? `Kreditt ${formatNOK(-playerProfile.balance)}`
                      : 'Ingen utestående'}
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate(createPageUrl('PaymentPortal'))} variant="outline" className="gap-2 min-h-[44px]">
                <Receipt className="w-4 h-4" /> Mine betalinger
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Non-admin: no player profile linked yet — already shown above, just payment shortcut */}
      {!isAdmin && playerProfile && (
        <Card className="border-0 shadow-sm bg-slate-50 dark:bg-slate-800/50">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">Se alle dine krav og betalingshistorikk</p>
            <Link to={createPageUrl('PaymentPortal')}>
              <Button size="sm" variant="outline" className="gap-2 min-h-[44px] shrink-0">
                <CreditCard className="w-4 h-4" /> Mine betalinger <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* KPI row – 4 cards */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total saldo" value={formatNOK(stats.balance)} icon={Wallet} variant={stats.balance >= 0 ? 'green' : 'red'} />
          <StatCard title="Inntekter denne mnd" value={formatNOK(stats.monthIncome)} icon={TrendingUp} variant="green" />
          <StatCard title="Utgifter denne mnd" value={formatNOK(stats.monthExpense)} icon={TrendingDown} variant="red" />

        </div>
      )}

      {/* Setup progress */}
      {isAdmin && !setupComplete && showSetup && (
        <SetupProgress completedSteps={completedSteps} onDismiss={() => setShowSetup(false)} />
      )}

      {/* Outstanding claims – top 5 */}
      {isAdmin && unpaidClaims.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Utestående krav</CardTitle>
            <Link to={createPageUrl('Players')}>
              <Button variant="ghost" size="sm" className="gap-1 text-emerald-600 hover:text-emerald-700">
                Se alle <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y dark:divide-slate-800">
              {unpaidClaims.map(claim => {
                const isOverdue = claim.status === 'overdue' || (claim.due_date && new Date(claim.due_date) < new Date());
                return (
                  <div key={claim.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{claim.description || claim.type}</p>
                      <p className="text-xs text-slate-400">
                        Forfall: {claim.due_date ? new Date(claim.due_date).toLocaleDateString('nb-NO') : '–'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${isOverdue ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                        {formatNOK(claim.amount)}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-600 dark:bg-red-500/10' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10'}`}>
                        {isOverdue ? 'Forfalt' : 'Ubetalt'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </PullToRefresh>
  );
}