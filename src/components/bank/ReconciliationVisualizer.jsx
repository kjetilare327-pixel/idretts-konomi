import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatNOK } from '@/components/shared/FormatUtils';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';

export default function ReconciliationVisualizer({ teamId }) {
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

  const reconciliationDetails = useMemo(() => {
    const reconciled = bankTx.filter(tx => tx.reconciled);
    const partiallyMatched = bankTx.filter(tx => !tx.reconciled && tx.matched_transaction_id);
    const unmatched = bankTx.filter(tx => !tx.reconciled && !tx.matched_transaction_id);

    const reconciledAmount = reconciled.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const partialAmount = partiallyMatched.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const unmatchedAmount = unmatched.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const totalAmount = reconciledAmount + partialAmount + unmatchedAmount;

    return {
      reconciled: reconciled.length,
      partial: partiallyMatched.length,
      unmatched: unmatched.length,
      total: bankTx.length,
      reconciledAmount,
      partialAmount,
      unmatchedAmount,
      totalAmount,
      reconciledPercent: totalAmount > 0 ? (reconciledAmount / totalAmount) * 100 : 0,
      partialPercent: totalAmount > 0 ? (partialAmount / totalAmount) * 100 : 0,
      unmatchedPercent: totalAmount > 0 ? (unmatchedAmount / totalAmount) * 100 : 0
    };
  }, [bankTx]);

  const discrepancies = useMemo(() => {
    const discList = [];
    
    bankTx.forEach(bankTx => {
      if (!bankTx.reconciled && bankTx.matched_transaction_id) {
        const matchedTx = transactions.find(t => t.id === bankTx.matched_transaction_id);
        if (matchedTx && Math.abs(matchedTx.amount - Math.abs(bankTx.amount)) > 0.01) {
          discList.push({
            bankDesc: bankTx.description,
            bankAmount: bankTx.amount,
            txAmount: matchedTx.amount,
            diff: matchedTx.amount - Math.abs(bankTx.amount),
            id: bankTx.id
          });
        }
      }
    });

    return discList.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [bankTx, transactions]);

  const statusColor = (percent) => {
    if (percent >= 90) return 'bg-emerald-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Main reconciliation progress */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Avstemmingsfremdrift
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall progress */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">Samlet fremdrift</span>
              <span className="text-2xl font-bold text-emerald-600">
                {reconciliationDetails.reconciledPercent.toFixed(0)}%
              </span>
            </div>
            <Progress value={reconciliationDetails.reconciledPercent} className="h-3" />
          </div>

          {/* Stacked bar with three states */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 flex gap-0.5 h-8 rounded-lg overflow-hidden">
                {reconciliationDetails.reconciledPercent > 0 && (
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${reconciliationDetails.reconciledPercent}%` }}
                    title={`Avstemt: ${reconciliationDetails.reconciledAmount} kr`}
                  />
                )}
                {reconciliationDetails.partialPercent > 0 && (
                  <div
                    className="bg-amber-500"
                    style={{ width: `${reconciliationDetails.partialPercent}%` }}
                    title={`Delvis matchet: ${reconciliationDetails.partialAmount} kr`}
                  />
                )}
                {reconciliationDetails.unmatchedPercent > 0 && (
                  <div
                    className="bg-red-500"
                    style={{ width: `${reconciliationDetails.unmatchedPercent}%` }}
                    title={`Ikke matchet: ${reconciliationDetails.unmatchedAmount} kr`}
                  />
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="p-3 rounded-lg border bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span className="font-semibold text-sm">Avstemt</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{reconciliationDetails.reconciled}</p>
                <p className="text-xs text-slate-500">{formatNOK(reconciliationDetails.reconciledAmount)}</p>
              </div>

              <div className="p-3 rounded-lg border bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span className="font-semibold text-sm">Delvis matchet</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">{reconciliationDetails.partial}</p>
                <p className="text-xs text-slate-500">{formatNOK(reconciliationDetails.partialAmount)}</p>
              </div>

              <div className="p-3 rounded-lg border bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span className="font-semibold text-sm">Ikke matchet</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{reconciliationDetails.unmatched}</p>
                <p className="text-xs text-slate-500">{formatNOK(reconciliationDetails.unmatchedAmount)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discrepancies */}
      {discrepancies.length > 0 && (
        <Card className="border-0 shadow-lg border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Avvik mellom bank og bilag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {discrepancies.map((disc, i) => (
                <div key={disc.id} className="p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{disc.bankDesc}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Bank: <span className="font-mono">{formatNOK(disc.bankAmount)}</span>
                        {' '} | Bilag: <span className="font-mono">{formatNOK(disc.txAmount)}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="border-amber-600 text-amber-600">
                      Diff: {disc.diff >= 0 ? '+' : ''}{formatNOK(disc.diff)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status summary */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400">Status</p>
                <p className="font-semibold">
                  {reconciliationDetails.unmatched === 0 ? (
                    <span className="text-emerald-600">Fullstendig avstemt</span>
                  ) : reconciliationDetails.reconciledPercent >= 90 ? (
                    <span className="text-emerald-600">Nesten ferdig</span>
                  ) : (
                    <span className="text-amber-600">I arbeid</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}