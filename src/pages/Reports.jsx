import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTeam } from '@/components/shared/TeamContext';
import { formatNOK } from '@/components/shared/FormatUtils';
import { FileBarChart, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

import BudgetVsActualReport from '@/components/reports/BudgetVsActualReport';
import IncomeStatement from '@/components/reports/IncomeStatement';
import ReportExport from '@/components/reports/ReportExport';
import ReadOnlyBanner from '@/components/shared/ReadOnlyBanner';

const FINANCE_ROLES = ['admin', 'kasserer', 'styreleder', 'revisor'];

export default function Reports() {
  const { currentTeam, currentTeamRole } = useTeam();
  const isAdmin = FINANCE_ROLES.includes(currentTeamRole);

  const CACHE = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 };

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id }, '-date'),
    enabled: !!currentTeam,
    ...CACHE,
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', currentTeam?.id],
    queryFn: () => base44.entities.Budget.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
    ...CACHE,
  });

  const stats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
  }, [transactions]);

  if (txLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {!isAdmin && <ReadOnlyBanner />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-emerald-600" /> Rapporter
          </h1>
          <p className="text-sm text-slate-500">{currentTeam?.name} – Finansielle rapporter</p>
        </div>
        {isAdmin && <ReportExport transactions={transactions} budgets={budgets} />}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Totale inntekter</p>
              <p className="text-xl font-bold text-emerald-600">{formatNOK(stats.totalIncome)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Totale utgifter</p>
              <p className="text-xl font-bold text-red-500">{formatNOK(stats.totalExpense)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.balance >= 0 ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
              <Wallet className={`w-5 h-5 ${stats.balance >= 0 ? 'text-blue-600' : 'text-red-500'}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Nettoresultat</p>
              <p className={`text-xl font-bold ${stats.balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatNOK(stats.balance)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income Statement */}
      <IncomeStatement transactions={transactions} />

      {/* Budget vs Actual */}
      {budgets.length > 0 && (
        <BudgetVsActualReport transactions={transactions} budgets={budgets} />
      )}
    </div>
  );
}