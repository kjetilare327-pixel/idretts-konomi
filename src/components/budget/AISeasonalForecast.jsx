import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, TrendingUp, TrendingDown, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import { formatNOK } from '../shared/FormatUtils';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MONTHS_NO = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];

export default function AISeasonalForecast({ teamId, transactions, budgets }) {
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState(null);

  // Pre-compute historical monthly averages for context
  const monthlyHistory = useMemo(() => {
    const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: MONTHS_NO[i], income: 0, expense: 0, count: 0 }));
    transactions.forEach(t => {
      if (!t.date) return;
      const m = new Date(t.date).getMonth();
      if (t.type === 'income') byMonth[m].income += t.amount;
      else byMonth[m].expense += t.amount;
      byMonth[m].count++;
    });
    return byMonth;
  }, [transactions]);

  const runForecast = async () => {
    setLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Du er en ekspert på norsk idrettslags økonomi. Analyser følgende historiske transaksjonsdata og generer en detaljert 12-måneders prognose med sesongvariasjoner.

Historisk månedlig aktivitet:
${monthlyHistory.map((m, i) => `${m.month}: Inntekter=${formatNOK(m.income)}, Utgifter=${formatNOK(m.expense)}`).join('\n')}

Totalt ${transactions.length} transaksjoner. Dagens budsjetter: ${budgets.length} poster.

Identifiser:
1. Sesongmønstre (f.eks. høy aktivitet vår/høst for idrettslag)
2. Fremtidige kostnadsdrivere (utstyr, cup-sesonger, etc.)
3. Månedlig prognose for neste 12 måneder basert på historikk og sesong
4. Anbefalinger for å optimere likviditet gjennom sesongen

Svar på norsk med tall i hele kroner.`,
        response_json_schema: {
          type: 'object',
          properties: {
            seasonalInsight: { type: 'string' },
            monthlyForecast: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  month: { type: 'string' },
                  projectedIncome: { type: 'number' },
                  projectedExpense: { type: 'number' },
                  seasonFactor: { type: 'string', enum: ['high', 'medium', 'low'] },
                  notes: { type: 'string' },
                }
              }
            },
            costDrivers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  driver: { type: 'string' },
                  estimatedImpact: { type: 'number' },
                  timing: { type: 'string' },
                  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  recommendation: { type: 'string' },
                }
              }
            },
            liquidityWarnings: { type: 'array', items: { type: 'string' } },
            topRecommendation: { type: 'string' },
          }
        }
      });
      setForecast(res);
    } catch (e) {
      alert('Feil: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const priorityColor = (p) => p === 'high' ? 'bg-red-100 text-red-700' : p === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
  const seasonColor = (s) => s === 'high' ? '#10b981' : s === 'medium' ? '#f59e0b' : '#94a3b8';

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Calendar className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle>AI Sesong- og trendprognose</CardTitle>
              <CardDescription>Prognoser med sesongvariasjoner og kostnadsdrivere</CardDescription>
            </div>
          </div>
          <Button onClick={runForecast} disabled={loading} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analyserer...' : 'Generer prognose'}
          </Button>
        </div>
      </CardHeader>

      {!forecast && !loading && (
        <CardContent>
          {/* Historical mini-chart */}
          <div className="h-48">
            <p className="text-xs text-slate-500 mb-2">Historisk månedlig aktivitet</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyHistory} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => formatNOK(v)} />
                <Legend />
                <Bar dataKey="income" name="Inntekt" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="expense" name="Utgift" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      )}

      {loading && (
        <CardContent className="py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-slate-500">Analyserer sesongmønstre og historiske trender...</p>
        </CardContent>
      )}

      {forecast && (
        <CardContent className="space-y-6">
          {/* Top insight */}
          <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900">
            <p className="text-sm text-indigo-800 dark:text-indigo-300">
              <span className="font-semibold">AI-innsikt:</span> {forecast.seasonalInsight}
            </p>
          </div>

          {/* Monthly forecast chart */}
          {forecast.monthlyForecast?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">12-måneders prognose</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecast.monthlyForecast}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={v => formatNOK(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="projectedIncome" stroke="#10b981" fill="#10b981" fillOpacity={0.15} name="Inntekter" />
                    <Area type="monotone" dataKey="projectedExpense" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="Utgifter" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                {forecast.monthlyForecast.filter(m => m.notes).slice(0, 4).map((m, i) => (
                  <div key={i} className="p-2 rounded border text-xs">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="font-semibold">{m.month}</span>
                      <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: seasonColor(m.seasonFactor) }} />
                    </div>
                    <p className="text-slate-500 leading-tight">{m.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost drivers */}
          {forecast.costDrivers?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-500" /> Fremtidige kostnadsdrivere
              </h3>
              <div className="space-y-2">
                {forecast.costDrivers.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50 dark:bg-slate-800">
                    <Badge className={`text-xs flex-shrink-0 ${priorityColor(d.priority)}`}>
                      {d.priority === 'high' ? 'Høy' : d.priority === 'medium' ? 'Middels' : 'Lav'}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{d.driver}</span>
                        <span className="text-sm font-semibold text-red-600 flex-shrink-0">{formatNOK(d.estimatedImpact)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{d.timing} – {d.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {forecast.liquidityWarnings?.length > 0 && (
            <div className="space-y-2">
              {forecast.liquidityWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">{w}</p>
                </div>
              ))}
            </div>
          )}

          {forecast.topRecommendation && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300"><span className="font-semibold">Anbefaling:</span> {forecast.topRecommendation}</p>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={runForecast} className="gap-2">
            <Sparkles className="w-4 h-4" /> Oppdater prognose
          </Button>
        </CardContent>
      )}
    </Card>
  );
}