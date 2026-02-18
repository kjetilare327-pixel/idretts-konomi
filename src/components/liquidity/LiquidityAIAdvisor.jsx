import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { formatNOK } from '@/components/shared/FormatUtils';
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, TrendingUp, Lightbulb } from 'lucide-react';

const RISK_COLORS = {
  high: 'text-red-600 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
  medium: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
  low: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
};

export default function LiquidityAIAdvisor({ transactions, claims, budgets, teamName }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const past3months = transactions.filter(t => {
        if (!t.date) return false;
        return new Date(t.date) >= new Date(now.getFullYear(), now.getMonth() - 3, 1);
      });

      const monthlyIncome = past3months.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) / 3;
      const monthlyExpense = past3months.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) / 3;
      const totalBalance = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        - transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const overdueClaims = claims.filter(c => c.status === 'overdue').reduce((s, c) => s + c.amount, 0);
      const pendingClaims = claims.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
      const monthlyBudget = budgets.filter(b => b.type === 'expense').reduce((s, b) => s + (b.monthly_amount || 0), 0);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Du er økonomiekspert for idrettslag. Analyser likviditeten for ${teamName || 'laget'}.

Data:
- Nåværende total saldo: ${formatNOK(totalBalance)}
- Gjennomsnittlig månedlig inntekt (siste 3 mnd): ${formatNOK(monthlyIncome)}
- Gjennomsnittlig månedlig utgift (siste 3 mnd): ${formatNOK(monthlyExpense)}
- Budsjetterte månedlige utgifter: ${formatNOK(monthlyBudget)}
- Forfalt utestående (overdue): ${formatNOK(overdueClaims)}
- Ventende utestående (pending): ${formatNOK(pendingClaims)}
- Netto månedlig cashflow: ${formatNOK(monthlyIncome - monthlyExpense)}

Identifiser:
1. Perioder med risiko for likviditetsmangel (30/60/90 dager frem)
2. Perioder med kontantoverskudd som kan optimaliseres
3. Konkrete, handlingsorienterte tiltak for å forbedre likviditeten

Svar på norsk med praktiske råd tilpasset et idrettslag.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_risk: { type: 'string', enum: ['high', 'medium', 'low'] },
            summary: { type: 'string' },
            risk_periods: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  period: { type: 'string' },
                  type: { type: 'string', enum: ['shortage', 'surplus'] },
                  description: { type: 'string' },
                  severity: { type: 'string', enum: ['high', 'medium', 'low'] },
                },
              },
            },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  impact: { type: 'string' },
                },
              },
            },
          },
        },
      });
      setAnalysis(result);
    } finally {
      setLoading(false);
    }
  };

  const priorityIcon = (p) => p === 'high' ? <AlertTriangle className="w-4 h-4" /> : p === 'low' ? <CheckCircle2 className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />;

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              AI Likviditetsanalyse
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Identifiser risikomomenter og optimaliseringsforslag</p>
          </div>
          <Button onClick={runAnalysis} disabled={loading} size="sm" className="bg-purple-600 hover:bg-purple-700 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Analyser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!analysis && !loading && (
          <div className="text-center py-8 text-slate-400">
            <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Klikk "Analyser" for å få AI-innsikt om likviditetsstyring</p>
          </div>
        )}
        {loading && (
          <div className="text-center py-8 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-purple-500" />
            <p className="text-sm">Analyserer kontantstrøm og identifiserer risikomomenter...</p>
          </div>
        )}
        {analysis && (
          <div className="space-y-5">
            {/* Overall risk */}
            <div className={`p-4 rounded-lg border ${RISK_COLORS[analysis.overall_risk]}`}>
              <div className="flex items-center gap-2 mb-1">
                <Badge className={analysis.overall_risk === 'high' ? 'bg-red-500' : analysis.overall_risk === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}>
                  {analysis.overall_risk === 'high' ? 'Høy risiko' : analysis.overall_risk === 'medium' ? 'Moderat risiko' : 'Lav risiko'}
                </Badge>
              </div>
              <p className="text-sm">{analysis.summary}</p>
            </div>

            {/* Risk periods */}
            {analysis.risk_periods?.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Identifiserte perioder</p>
                <div className="space-y-2">
                  {analysis.risk_periods.map((rp, i) => (
                    <div key={i} className={`p-3 rounded-lg border text-sm ${rp.type === 'shortage' ? 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{rp.period}</span>
                        <Badge variant="outline" className={rp.type === 'shortage' ? 'text-red-600 border-red-200' : 'text-emerald-600 border-emerald-200'}>
                          {rp.type === 'shortage' ? '⚠ Mangel' : '✓ Overskudd'}
                        </Badge>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">{rp.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations?.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Anbefalte tiltak</p>
                <div className="space-y-2">
                  {analysis.recommendations.map((rec, i) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 ${rec.priority === 'high' ? 'text-red-500' : rec.priority === 'medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {priorityIcon(rec.priority)}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{rec.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{rec.description}</p>
                          {rec.impact && <p className="text-xs text-emerald-600 mt-1 font-medium">Forventet effekt: {rec.impact}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}