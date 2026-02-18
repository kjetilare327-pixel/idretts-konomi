import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, AlertTriangle, TrendingUp, TrendingDown, Info, ShieldCheck } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function AIAnomalyDetector({ transactions, budgets, claims }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setLoading(true);
    try {
      // Build a compact summary to keep the prompt focused
      const catTotals = {};
      transactions.forEach(t => {
        const key = `${t.type}::${t.category}`;
        catTotals[key] = (catTotals[key] || 0) + t.amount;
      });

      // Monthly amounts
      const monthly = {};
      transactions.forEach(t => {
        if (!t.date) return;
        const ym = t.date.slice(0, 7);
        if (!monthly[ym]) monthly[ym] = { income: 0, expense: 0 };
        if (t.type === 'income') monthly[ym].income += t.amount;
        else monthly[ym].expense += t.amount;
      });

      const recentTx = transactions.slice(-20).map(t => ({
        date: t.date, type: t.type, category: t.category, amount: t.amount, description: t.description?.slice(0, 60)
      }));

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Du er revisor og finansanalytiker for et norsk idrettslag. Analyser følgende finansielle data og identifiser avvik, anomalier og uvanlige mønstre.

Kategorisummering:
${Object.entries(catTotals).map(([k, v]) => `${k}: ${v} kr`).join('\n')}

Månedlig utvikling:
${Object.entries(monthly).sort().map(([ym, d]) => `${ym}: inntekter=${d.income} kr, utgifter=${d.expense} kr, netto=${d.income-d.expense} kr`).join('\n')}

Siste 20 transaksjoner:
${JSON.stringify(recentTx, null, 1)}

Åpne krav: ${claims.filter(c => c.status === 'pending' || c.status === 'overdue').length} stk, 
forfalt sum: ${claims.filter(c => c.status === 'overdue').reduce((s,c)=>s+c.amount,0)} kr

Identifiser:
1. Uvanlig store enkelt-transaksjoner
2. Kategorier med plutselig økning/nedgang
3. Måneder med unormalt høye utgifter
4. Duplikat-mistanker (like beløp nær hverandre)
5. Positive overraskelser (uventede inntekter)
6. Generelle innsikter og anbefalinger

Svar på norsk.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overallHealth: { type: 'string', enum: ['good', 'warning', 'critical'] },
            healthSummary: { type: 'string' },
            anomalies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  severity: { type: 'string', enum: ['high', 'medium', 'low', 'positive'] },
                  category: { type: 'string' },
                  amount: { type: 'number' },
                  recommendation: { type: 'string' },
                }
              }
            },
            insights: { type: 'array', items: { type: 'string' } },
            positiveFindings: { type: 'array', items: { type: 'string' } },
          }
        }
      });
      setResult(res);
    } catch (e) {
      alert('Feil: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const severityConfig = {
    high: { color: 'border-red-200 bg-red-50 dark:bg-red-950/20', badge: 'bg-red-100 text-red-700', icon: AlertTriangle, iconColor: 'text-red-500' },
    medium: { color: 'border-amber-200 bg-amber-50 dark:bg-amber-950/20', badge: 'bg-amber-100 text-amber-700', icon: AlertTriangle, iconColor: 'text-amber-500' },
    low: { color: 'border-blue-200 bg-blue-50 dark:bg-blue-950/20', badge: 'bg-blue-100 text-blue-700', icon: Info, iconColor: 'text-blue-500' },
    positive: { color: 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20', badge: 'bg-emerald-100 text-emerald-700', icon: TrendingUp, iconColor: 'text-emerald-500' },
  };

  const healthConfig = {
    good: { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200', icon: ShieldCheck },
    warning: { color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200', icon: AlertTriangle },
    critical: { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20 border-red-200', icon: AlertTriangle },
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <CardTitle>AI Avviksdeteksjon & Innsikt</CardTitle>
              <CardDescription>AI analyserer transaksjoner og identifiserer anomalier, mønstre og muligheter</CardDescription>
            </div>
          </div>
          <Button onClick={run} disabled={loading} className="gap-2 bg-violet-600 hover:bg-violet-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analyserer...' : 'Kjør AI-analyse'}
          </Button>
        </div>
      </CardHeader>

      {loading && (
        <CardContent className="py-10 flex flex-col items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-violet-600 mb-3" />
          <p className="text-slate-500 text-sm">Analyserer transaksjonshistorikk og søker etter avvik...</p>
        </CardContent>
      )}

      {result && (
        <CardContent className="space-y-5">
          {/* Overall health */}
          {result.healthSummary && (() => {
            const hcfg = healthConfig[result.overallHealth] || healthConfig.good;
            const HIcon = hcfg.icon;
            return (
              <div className={`flex items-start gap-3 p-4 rounded-lg border ${hcfg.bg}`}>
                <HIcon className={`w-5 h-5 ${hcfg.color} flex-shrink-0 mt-0.5`} />
                <div>
                  <span className={`text-sm font-semibold ${hcfg.color}`}>
                    {result.overallHealth === 'good' ? 'God finansiell helse' : result.overallHealth === 'warning' ? 'Advarsler funnet' : 'Kritiske avvik funnet'}
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{result.healthSummary}</p>
                </div>
              </div>
            );
          })()}

          {/* Anomalies */}
          {result.anomalies?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avvik og varsler ({result.anomalies.length})</p>
              {result.anomalies.map((a, i) => {
                const cfg = severityConfig[a.severity] || severityConfig.low;
                const Icon = cfg.icon;
                return (
                  <div key={i} className={`p-3 rounded-lg border ${cfg.color}`}>
                    <div className="flex items-start gap-2">
                      <Icon className={`w-4 h-4 ${cfg.iconColor} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-medium">{a.title}</span>
                          <Badge className={`text-xs ${cfg.badge}`}>
                            {a.severity === 'high' ? 'Høy' : a.severity === 'medium' ? 'Middels' : a.severity === 'low' ? 'Lav' : 'Positivt'}
                          </Badge>
                          {a.category && <span className="text-xs text-slate-500">{a.category}</span>}
                          {a.amount > 0 && <span className="text-xs font-semibold ml-auto">{formatNOK(a.amount)}</span>}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{a.description}</p>
                        {a.recommendation && (
                          <p className="text-xs text-slate-500 mt-1 italic">→ {a.recommendation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Insights */}
          {result.insights?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Innsikter</p>
              {result.insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600 dark:text-slate-400">{ins}</span>
                </div>
              ))}
            </div>
          )}

          {/* Positive findings */}
          {result.positiveFindings?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Positive funn</p>
              {result.positiveFindings.map((p, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600 dark:text-slate-400">{p}</span>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={run} className="gap-2">
            <Sparkles className="w-4 h-4" /> Oppdater analyse
          </Button>
        </CardContent>
      )}
    </Card>
  );
}