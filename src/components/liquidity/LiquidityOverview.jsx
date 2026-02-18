import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNOK } from '@/components/shared/FormatUtils';
import { Building2, Banknote, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';

const ACCOUNT_TYPES = [
  { id: 'main', label: 'Driftskonto', icon: Building2, color: 'emerald' },
  { id: 'savings', label: 'Sparekonto', icon: Banknote, color: 'blue' },
  { id: 'reserve', label: 'Reservefond', icon: CreditCard, color: 'purple' },
];

export default function LiquidityOverview({ transactions, claims }) {
  const accounts = useMemo(() => {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const netBalance = totalIncome - totalExpense;

    const monthIncome = transactions
      .filter(t => t.type === 'income' && t.date?.startsWith(curMonth))
      .reduce((s, t) => s + t.amount, 0);
    const monthExpense = transactions
      .filter(t => t.type === 'expense' && t.date?.startsWith(curMonth))
      .reduce((s, t) => s + t.amount, 0);

    const pendingClaims = claims.filter(c => c.status === 'pending' || c.status === 'overdue');
    const pendingAmount = pendingClaims.reduce((s, c) => s + c.amount, 0);

    // Distribute balance across accounts (realistic split)
    const main = Math.max(netBalance * 0.7, 0);
    const savings = Math.max(netBalance * 0.2, 0);
    const reserve = Math.max(netBalance * 0.1, 0);

    return {
      accounts: [
        { ...ACCOUNT_TYPES[0], balance: main, change: monthIncome - monthExpense },
        { ...ACCOUNT_TYPES[1], balance: savings, change: 0 },
        { ...ACCOUNT_TYPES[2], balance: reserve, change: 0 },
      ],
      totalBalance: netBalance,
      monthIncome,
      monthExpense,
      pendingAmount,
      pendingCount: pendingClaims.length,
    };
  }, [transactions, claims]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {accounts.accounts.map(acc => (
          <Card key={acc.id} className="border-0 shadow-md dark:bg-slate-900">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg bg-${acc.color}-50 dark:bg-${acc.color}-500/10`}>
                  <acc.icon className={`w-5 h-5 text-${acc.color}-600`} />
                </div>
                {acc.change !== 0 && (
                  <Badge variant="outline" className={acc.change > 0 ? 'text-emerald-600 border-emerald-200' : 'text-red-600 border-red-200'}>
                    {acc.change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {formatNOK(Math.abs(acc.change))}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-1">{acc.label}</p>
              <p className="text-2xl font-bold">{formatNOK(acc.balance)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Consolidated summary */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-500">Total likviditet</p>
              <p className={`text-xl font-bold ${accounts.totalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatNOK(accounts.totalBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Inn denne mnd</p>
              <p className="text-xl font-bold text-emerald-600">{formatNOK(accounts.monthIncome)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Ut denne mnd</p>
              <p className="text-xl font-bold text-red-600">{formatNOK(accounts.monthExpense)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Utestående krav</p>
              <p className="text-xl font-bold text-amber-600">{formatNOK(accounts.pendingAmount)}</p>
              <p className="text-xs text-slate-400">{accounts.pendingCount} krav</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}