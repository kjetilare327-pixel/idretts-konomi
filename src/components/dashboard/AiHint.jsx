import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function AiHint({ transactions, budgets }) {
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!transactions || transactions.length === 0) {
      setHint('Legg til transaksjoner for å få personlige økonomitips.');
      return;
    }
    generateHint();
  }, [transactions, budgets]);

  const generateHint = async () => {
    setLoading(true);
    
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    
    const expenseByCategory = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
    });

    const budgetComparison = budgets.map(b => {
      const spent = expenseByCategory[b.category] || 0;
      return `${b.category}: budsjett ${b.monthly_amount} kr, brukt ${spent} kr`;
    }).join(', ');

    const prompt = `Du er en økonomirådgiver for et norsk idrettslag. Gi ETT kort, konkret tips (maks 2 setninger) på norsk basert på disse tallene:
    
Total inntekter: ${totalIncome} kr
Total utgifter: ${totalExpense} kr
Saldo: ${totalIncome - totalExpense} kr
Utgifter per kategori: ${JSON.stringify(expenseByCategory)}
Budsjettsammenligning: ${budgetComparison || 'Ingen budsjett satt'}

Vær konkret og gi et handlingsrettet tips.`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({ prompt });
      setHint(res);
    } catch {
      // Fallback static logic
      const overBudget = budgets.find(b => {
        const spent = expenseByCategory[b.category] || 0;
        return b.monthly_amount > 0 && spent > b.monthly_amount;
      });
      
      if (overBudget) {
        const spent = expenseByCategory[overBudget.category] || 0;
        const pct = Math.round(((spent - overBudget.monthly_amount) / overBudget.monthly_amount) * 100);
        setHint(`Du er ${pct}% over budsjett på ${overBudget.category.toLowerCase()} – vurder å justere utgiftene neste måned.`);
      } else if (totalExpense > totalIncome) {
        setHint('Utgiftene overstiger inntektene. Vurder å øke inntektskilder eller redusere utgifter.');
      } else {
        setHint(`God økonomi! Saldo er ${formatNOK(totalIncome - totalExpense)}. Fortsett å følge budsjettet.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-md bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/5 dark:to-teal-500/5 dark:bg-slate-900">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
          {loading ? <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-600" />}
        </div>
        <div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">AI Økonomitips</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{hint || 'Analyserer...'}</p>
        </div>
      </CardContent>
    </Card>
  );
}