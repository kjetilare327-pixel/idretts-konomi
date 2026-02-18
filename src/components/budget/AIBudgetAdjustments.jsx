import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function AIBudgetAdjustments({ budgets = [], transactions = [], onApply }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  const generate = async () => {
    setLoading(true);
    setSuggestions(null);

    const now = new Date();
    const last3Months = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last3Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const monthlyActuals = {};
    transactions.forEach(t => {
      if (!t.date || !t.category) return;
      const ym = t.date.slice(0, 7);
      if (last3Months.includes(ym)) {
        if (!monthlyActuals[t.category]) monthlyActuals[t.category] = { income: 0, expense: 0, count: 0 };
        if (t.type === 'expense') { monthlyActuals[t.category].expense += t.amount; monthlyActuals[t.category].count++; }
        else monthlyActuals[t.category].income += t.amount;
      }
    });

    const budgetSummary = budgets.map(b => ({
      category: b.category,
      type: b.type,
      current_monthly: b.monthly_amount,
      avg_actual_3m: b.type === 'expense'
        ? Math.round((monthlyActuals[b.category]?.expense || 0) / 3)
        : Math.round((monthlyActuals[b.category]?.income || 0) / 3),
    }));

    const prompt = `Du er budsjettanalytiker for et norsk idrettslag. Analyser budsjett vs faktiske tall og foreslå justeringer på norsk.

Budsjett og snitt siste 3 måneder:
${JSON.stringify(budgetSummary, null, 2)}

For hver kategori med vesentlig avvik (>15%), foreslå:
1. Ny anbefalt månedlig budsjettgrense
2. Kort begrunnelse basert på trenden
3. Prioritet (høy/middels/lav)

Fokuser på kategorier der faktisk forbruk konsekvent avviker fra budsjett.`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            adjustments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  current_amount: { type: 'number' },
                  suggested_amount: { type: 'number' },
                  change_direction: { type: 'string', enum: ['increase', 'decrease'] },
                  reason: { type: 'string' },
                  priority: { type: 'string', enum: ['høy', 'middels', 'lav'] },
                }
              }
            }
          }
        }
      });
      setSuggestions(res);
    } catch (e) {
      setSuggestions({ error: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base">AI Budsjettjusteringer</CardTitle>
              <CardDescription>Forslag basert på historiske trender og faktisk forbruk</CardDescription>
            </div>
          </div>
          <Button onClick={generate} disabled={loading} size="sm" variant="outline" className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analyserer...' : 'Generer forslag'}
          </Button>
        </div>
      </CardHeader>
      {(loading || suggestions) && (
        <CardContent>
          {loading && (
            <div className="text-center py-6">
              <Loader2 className="w-7 h-7 animate-spin mx-auto text-indigo-500 mb-2" />
              <p className="text-sm text-slate-500">Analyserer budsjett og transaksjonshistorikk...</p>
            </div>
          )}
          {suggestions && !suggestions.error && (
            <div className="space-y-4">
              {suggestions.summary && (
                <p className="text-sm text-slate-600 dark:text-slate-400 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">{suggestions.summary}</p>
              )}
              <div className="space-y-3">
                {suggestions.adjustments?.map((adj, i) => (
                  <div key={i} className={`p-3 rounded-lg border flex items-start gap-3 ${
                    adj.change_direction === 'decrease'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200'
                      : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200'
                  }`}>
                    <div className={`mt-0.5 p-1 rounded ${adj.change_direction === 'decrease' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                      {adj.change_direction === 'decrease'
                        ? <TrendingDown className="w-3.5 h-3.5 text-emerald-700" />
                        : <TrendingUp className="w-3.5 h-3.5 text-amber-700" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-medium text-sm">{adj.category}</span>
                        <Badge className={`text-xs border-0 ${adj.priority === 'høy' ? 'bg-red-100 text-red-700' : adj.priority === 'middels' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                          {adj.priority}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs font-semibold ml-auto">
                          <span className="text-slate-500">{formatNOK(adj.current_amount)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className={adj.change_direction === 'decrease' ? 'text-emerald-700' : 'text-amber-700'}>{formatNOK(adj.suggested_amount)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{adj.reason}</p>
                    </div>
                    {onApply && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0"
                        onClick={() => onApply(adj)}>
                        Bruk
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {suggestions?.error && <p className="text-sm text-red-500 text-center py-2">Kunne ikke generere forslag.</p>}
        </CardContent>
      )}
    </Card>
  );
}