import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, TrendingUp, TrendingDown, Droplets, AlertTriangle } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des'];

export default function AIFinancialTrends({ transactions, budgets, claims }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setLoading(true);
    try {
      // Build monthly summary
      const monthly = {};
      transactions.forEach(t => {
        if (!t.date) return;
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (!monthly[key]) monthly[key] = { income: 0, expense: 0 };
        if (t.type === 'income') monthly[key].income += t.amount;
        else monthly[key].expense += t.amount;
      });
      const historicalMonths = Object.entries(monthly).sort().slice(-12);

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Du er finansanalytiker for et norsk idrettslag. Basert på historiske månedlige data, prediker fremtidige inntekter og utgifter for de neste 6 månedene.

Historiske månedlige tall (siste 12 måneder):
${historicalMonths.map(([k, v]) => `${k}: Inntekter=${v.income} kr, Utgifter=${v.expense} kr, Netto=${v.income-v.expense} kr`).join('\n')}

Åpne krav: ${claims.filter(c=>c.status==='pending').reduce((s,c)=>s+c.amount,0)} kr ventende, ${claims.filter(c=>c.status==='overdue').reduce((s,c)=>s+c.amount,0)} kr forfalt

Analyser:
1. Trendretning (vekst/nedgang) per inntekt og utgift
2. Sesongvariasjoner i dataene
3. Prediker de neste 6 månedene med øvre og nedre grenser (konfidensintervall)
4. Identifiser likviditetsrisiko-perioder
5. Konkrete anbefalinger for inntektsgenerering basert på mønstre

Svar på norsk. Neste måned er ${MONTHS_SHORT[new Date().getMonth()]} ${new Date().getFullYear()}.`,
        response_json_schema: {
          type: 'object',
          properties: {
            trendSummary: { type: 'string' },
            incomeTrend: { type: 'string', enum: ['growing', 'stable', 'declining'] },
            expenseTrend: { type: 'string', enum: ['growing', 'stable', 'declining'] },
            predictions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  month: { type: 'string' },
                  predictedIncome: { type: 'number' },
                  predictedExpense: { type: 'number' },
                  incomeHigh: { type: 'number' },
                  incomeLow: { type: 'number' },
                  expenseHigh: { type: 'number' },
                  expenseLow: { type: 'number' },
                  liquidityRisk: { type: 'string', enum: ['high', 'medium', 'low'] },
                  note: { type: 'string' },
                }
              }
            },
            incomeOpportunities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  estimatedAmount: { type: 'number' },
                  timing: { type: 'string' },
                  effort: { type: 'string', enum: ['low', 'medium', 'high'] },
                }
              }
            },
            costSavings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  estimatedSaving: { type: 'number' },
                  category: { type: 'string' },
                  actionSteps: { type: 'array', items: { type: 'string' } },
                }
              }
            },
            liquidityWarningMonths: { type: 'array', items: { type: 'string' } },
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

  const trendIcon = (t) => t === 'growing' ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : t === 'declining' ? <TrendingDown className="w-4 h-4 text-red-500" /> : <span className="text-slate-400 text-xs">→</span>;
  const effortColor = (e) => e === 'low' ? 'bg-emerald-100 text-emerald-700' : e === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  const riskColor = (r) => r === 'high' ? 'text-red-600' : r === 'medium' ? 'text-amber-600' : 'text-emerald-600';

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>AI Finansielle Trendprediksjoner</CardTitle>
              <CardDescription>6-måneders prognoser med konfidensintervaller, inntektsmuligheter og kostnadsbesparelser</CardDescription>
            </div>
          </div>
          <Button onClick={run} disabled={loading} className="gap-2 bg-blue-600 hover:bg-blue-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analyserer...' : 'Prediksjon'}
          </Button>
        </div>
      </CardHeader>

      {loading && (
        <CardContent className="py-10 flex flex-col items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600 mb-3" />
          <p className="text-slate-500 text-sm">Analyserer trender og genererer 6-måneders prognose...</p>
        </CardContent>
      )}

      {result && (
        <CardContent className="space-y-6">
          {/* Trend summary */}
          <div className="flex flex-wrap gap-3 items-start">
            <div className="flex-1 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
              {result.trendSummary}
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-sm">
                {trendIcon(result.incomeTrend)} <span>Inntekt</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm">
                {trendIcon(result.expenseTrend)} <span>Utgift</span>
              </div>
            </div>
          </div>

          {/* Prediction chart */}
          {result.predictions?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">6-måneders prognose</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.predictions}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={40} />
                    <Tooltip formatter={v => formatNOK(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="incomeHigh" stroke="transparent" fill="#10b981" fillOpacity={0.1} name="Inntekt maks" legendType="none" />
                    <Area type="monotone" dataKey="incomeLow" stroke="transparent" fill="#ffffff" fillOpacity={1} name="Inntekt min" legendType="none" />
                    <Area type="monotone" dataKey="predictedIncome" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Prediksjon inntekt" />
                    <Area type="monotone" dataKey="expenseHigh" stroke="transparent" fill="#ef4444" fillOpacity={0.1} name="Utgift maks" legendType="none" />
                    <Area type="monotone" dataKey="predictedExpense" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} name="Prediksjon utgift" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                {result.predictions.map((p, i) => (
                  <div key={i} className="p-2 rounded border text-xs flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{p.month}</span>
                      <span className={`text-xs font-medium ${riskColor(p.liquidityRisk)}`}>
                        {p.liquidityRisk === 'high' ? '⚠ Høy' : p.liquidityRisk === 'medium' ? '◈ Middels' : '✓ Lav'} risiko
                      </span>
                    </div>
                    <span className="text-emerald-600">↑ {formatNOK(p.predictedIncome)}</span>
                    <span className="text-red-500">↓ {formatNOK(p.predictedExpense)}</span>
                    {p.note && <span className="text-slate-400 leading-tight">{p.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost savings */}
          {result.costSavings?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-blue-500" /> Konkrete kostnadsbesparelser
              </h3>
              <div className="space-y-2">
                {result.costSavings.map((s, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{s.title}</span>
                      <span className="text-sm font-semibold text-blue-700">Spar {formatNOK(s.estimatedSaving)}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{s.description}</p>
                    {s.actionSteps?.length > 0 && (
                      <ul className="text-xs text-slate-500 space-y-0.5">
                        {s.actionSteps.map((step, j) => <li key={j}>• {step}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Income opportunities */}
          {result.incomeOpportunities?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Inntektsgenereringsmuligheter
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.incomeOpportunities.map((op, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm flex-1">{op.title}</span>
                      <Badge className={`text-xs ${effortColor(op.effort)}`}>
                        {op.effort === 'low' ? 'Lite arbeid' : op.effort === 'medium' ? 'Middels' : 'Mye arbeid'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{op.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{op.timing}</span>
                      <span className="font-semibold text-emerald-700">+{formatNOK(op.estimatedAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.liquidityWarningMonths?.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Likviditetsrisiko:</span> {result.liquidityWarningMonths.join(', ')} forventes å ha stramme likviditetsforhold.
              </p>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={run} className="gap-2">
            <Sparkles className="w-4 h-4" /> Oppdater prediksjon
          </Button>
        </CardContent>
      )}
    </Card>
  );
}