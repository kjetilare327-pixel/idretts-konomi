import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, TrendingUp, Gift, AlertCircle } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';
import ReactMarkdown from 'react-markdown';

export default function AISponsorAdvisor({ sponsors = [], transactions = [], teamName }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const runAnalysis = async () => {
    setLoading(true);
    const totalSponsor = sponsors.filter(s => s.type === 'sponsor' && s.status === 'active').reduce((s, x) => s + x.amount, 0);
    const totalGrant = sponsors.filter(s => s.type === 'grant' && s.status === 'active').reduce((s, x) => s + x.amount, 0);
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const deficit = Math.max(0, totalExpense - totalIncome);

    const prompt = `Du er økonomiekspert for norske idrettslag.
Lag: ${teamName}
Nåværende sponsorinntekter: ${formatNOK(totalSponsor)}/år
Nåværende tilskudd: ${formatNOK(totalGrant)}/år
Totale inntekter: ${formatNOK(totalIncome)}
Totale utgifter: ${formatNOK(totalExpense)}
Finansieringsbehov: ${formatNOK(deficit)}
Antall aktive sponsorer: ${sponsors.filter(s => s.type === 'sponsor').length}

Gi konkrete anbefalinger:
1. Optimal sponsorpakkestruktur med foreslåtte priser (Bronze/Sølv/Gull-modell)
2. Identifiser 3-5 potensielle tilskuddskilder som passer for norske idrettslag (NIF, Grasrotandelen, kommunale midler, Norsk Tipping, osv.)
3. Forbedringsforslag for å øke sponsorinntekter
4. Spesifikke tiltak for å redusere finansieringsunderskudd

Svar på norsk og vær konkret med kronebeløp og prosentsatser.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          sponsor_packages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                price: { type: 'number' },
                benefits: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          grant_opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                potential_amount: { type: 'number' },
                description: { type: 'string' },
                deadline_note: { type: 'string' },
              },
            },
          },
          recommendations: { type: 'string' },
          potential_increase: { type: 'number' },
        },
      },
    });
    setResult(res);
    setLoading(false);
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              AI Sponsor- og tilskuddsrådgiver
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Optimal sponsorpris og tilskuddsmuligheter basert på lagets økonomi</p>
          </div>
          <Button onClick={runAnalysis} disabled={loading} size="sm" className="bg-purple-600 hover:bg-purple-700 gap-2 shrink-0">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? 'Analyserer...' : 'Analyser'}
          </Button>
        </div>
      </CardHeader>
      {result && (
        <CardContent className="space-y-4">
          {/* Sponsor packages */}
          {result.sponsor_packages?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Anbefalte sponsorpakker</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {result.sponsor_packages.map((pkg, i) => (
                  <div key={i} className={`p-3 rounded-lg border-2 ${i === 2 ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10' : i === 1 ? 'border-slate-300 bg-slate-50 dark:bg-slate-800' : 'border-orange-300 bg-orange-50 dark:bg-orange-500/10'}`}>
                    <p className="font-bold text-sm">{pkg.name}</p>
                    <p className="text-xl font-bold text-emerald-600 my-1">{formatNOK(pkg.price)}<span className="text-xs text-slate-400">/år</span></p>
                    <ul className="space-y-0.5">
                      {pkg.benefits?.map((b, j) => <li key={j} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1"><span className="text-emerald-500 mt-0.5">✓</span>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grant opportunities */}
          {result.grant_opportunities?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tilskuddmuligheter</p>
              <div className="space-y-2">
                {result.grant_opportunities.map((g, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20">
                    <Gift className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{g.name}</p>
                        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 shrink-0">
                          {formatNOK(g.potential_amount)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{g.description}</p>
                      {g.deadline_note && <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{g.deadline_note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {result.potential_increase > 0 && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Potensial for økt finansiering</p>
                <p className="text-xl font-bold text-emerald-600">{formatNOK(result.potential_increase)}</p>
              </div>
            </div>
          )}

          {result.recommendations && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Anbefalinger</p>
              <ReactMarkdown className="prose prose-sm prose-slate dark:prose-invert max-w-none text-xs">{result.recommendations}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}