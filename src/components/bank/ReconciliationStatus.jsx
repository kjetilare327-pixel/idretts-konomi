import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function ReconciliationStatus({ teamId }) {
  const { data: bankTx = [] } = useQuery({
    queryKey: ['bank-transactions', teamId],
    queryFn: () => base44.entities.BankTransaction.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', teamId],
    queryFn: () => base44.entities.Transaction.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const reconciled = bankTx.filter(tx => tx.reconciled).length;
  const unreconciled = bankTx.length - reconciled;
  const reconciliationRate = bankTx.length > 0 ? (reconciled / bankTx.length) * 100 : 0;

  const unmatchedAmount = bankTx
    .filter(tx => !tx.reconciled)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const reconciledTransactions = transactions.filter(tx => tx.reconciled === 'reconciled').length;
  const unreconciledTransactions = transactions.filter(tx => tx.reconciled === 'unreconciled').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Avstemt rate</p>
              <p className="text-3xl font-bold text-emerald-600">{Math.round(reconciliationRate)}%</p>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <Progress value={reconciliationRate} className="mt-4 h-2" />
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Avstemte transaksjoner</p>
              <p className="text-3xl font-bold">{reconciled}</p>
              <p className="text-xs text-slate-500 mt-1">av {bankTx.length} totalt</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Venter på avstemming</p>
              <p className="text-3xl font-bold text-amber-600">{unreconciled}</p>
              <p className="text-xs text-slate-500 mt-1">{formatNOK(unmatchedAmount)}</p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Manuelle transaksjoner</p>
              <p className="text-3xl font-bold text-slate-600">{unreconciledTransactions}</p>
              <p className="text-xs text-slate-500 mt-1">Ikke matchet mot bank</p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <AlertCircle className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}