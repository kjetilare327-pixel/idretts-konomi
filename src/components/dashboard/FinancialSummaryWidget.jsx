import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNOK } from '@/components/shared/FormatUtils';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function FinancialSummaryWidget({ teamId }) {
  const navigate = useNavigate();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', teamId],
    queryFn: () => base44.entities.Transaction.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const summary = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const net = income - expenses;

    return { income, expenses, net };
  }, [transactions]);

  return (
    <Card 
      className="border-0 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
      onClick={() => navigate(createPageUrl('Transactions'))}
    >
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-600" />
          Økonomisk oversikt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Inntekter</span>
            </div>
            <span className="font-semibold text-emerald-600">{formatNOK(summary.income)}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Utgifter</span>
            </div>
            <span className="font-semibold text-red-600">{formatNOK(summary.expenses)}</span>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-lg ${summary.net >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
            <span className="text-sm font-semibold">Netto</span>
            <span className={`font-bold text-lg ${summary.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {summary.net >= 0 ? '+' : ''}{formatNOK(summary.net)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}