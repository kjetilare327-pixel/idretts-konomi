import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTeam } from '@/components/shared/TeamContext';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatNOK } from '@/components/shared/FormatUtils';
import { Wallet, TrendingUp, TrendingDown, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import StatCard from '@/components/dashboard/StatCard';
import MonthlyChart from '@/components/dashboard/MonthlyChart';
import BudgetDeviationBar from '@/components/dashboard/BudgetDeviationBar';
import TopExpenses from '@/components/dashboard/TopExpenses';
import SubscriptionBanner from '@/components/dashboard/SubscriptionBanner';
import AiHint from '@/components/dashboard/AiHint';

export default function Dashboard() {
  const { currentTeam, teams, loading: teamLoading, isTeamAdmin, playerProfile } = useTeam();
  const navigate = useNavigate();
  const isAdmin = isTeamAdmin();

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id }, '-date'),
    enabled: !!currentTeam,
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', currentTeam?.id],
    queryFn: () => base44.entities.Budget.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const stats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = totalIncome - totalExpense;

    // Current month
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthIncome = transactions.filter(t => t.type === 'income' && t.date?.startsWith(curMonth)).reduce((s, t) => s + t.amount, 0);
    const monthExpense = transactions.filter(t => t.type === 'expense' && t.date?.startsWith(curMonth)).reduce((s, t) => s + t.amount, 0);

    return { totalIncome, totalExpense, balance, monthIncome, monthExpense };
  }, [transactions]);

  const budgetDeviations = useMemo(() => {
    const expByCategory = {};
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    transactions.filter(t => t.type === 'expense' && t.date?.startsWith(curMonth)).forEach(t => {
      expByCategory[t.category] = (expByCategory[t.category] || 0) + t.amount;
    });
    return budgets.filter(b => b.type === 'expense' && b.monthly_amount > 0).map(b => ({
      category: b.category,
      spent: expByCategory[b.category] || 0,
      budgeted: b.monthly_amount,
    }));
  }, [transactions, budgets]);

  if (teamLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  if (!currentTeam && teams.length === 0) {
    navigate(createPageUrl('Onboarding'));
    return null;
  }

  return (
    <div className="space-y-6">
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

      {!isAdmin && playerProfile && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Din saldo</p>
                <p className={`text-3xl font-bold ${playerProfile.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {playerProfile.balance > 0 ? `Skylder ${formatNOK(playerProfile.balance)}` : playerProfile.balance < 0 ? `Kreditt ${formatNOK(-playerProfile.balance)}` : 'Ingen utestående'}
                </p>
              </div>
              <Button onClick={() => navigate(createPageUrl('Players'))} variant="outline" className="gap-2">
                Se detaljer <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && <SubscriptionBanner team={currentTeam} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total saldo" value={formatNOK(stats.balance)} icon={Wallet} variant={stats.balance >= 0 ? 'green' : 'red'} />
        <StatCard title="Inntekter (total)" value={formatNOK(stats.totalIncome)} icon={TrendingUp} variant="green" />
        <StatCard title="Utgifter (total)" value={formatNOK(stats.totalExpense)} icon={TrendingDown} variant="red" />
        <StatCard title="Denne mnd" value={formatNOK(stats.monthIncome - stats.monthExpense)} subtitle={`${formatNOK(stats.monthIncome)} inn / ${formatNOK(stats.monthExpense)} ut`} icon={Wallet} variant="blue" />
      </div>

      <AiHint transactions={transactions} budgets={budgets} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MonthlyChart transactions={transactions} />
        </div>
        <div className="space-y-6">
          <TopExpenses transactions={transactions} />
          {budgetDeviations.length > 0 && (
            <Card className="border-0 shadow-md dark:bg-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Budsjettavvik</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {budgetDeviations.map(d => (
                  <BudgetDeviationBar key={d.category} {...d} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}