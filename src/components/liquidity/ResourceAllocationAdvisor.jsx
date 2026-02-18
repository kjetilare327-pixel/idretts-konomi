import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { formatNOK } from '@/components/shared/FormatUtils';
import { Sparkles, Loader2, TrendingUp, TrendingDown, Target, DollarSign, Lightbulb, ArrowUpRight } from 'lucide-react';

const CATEGORY_COLORS = {
  investment: 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-300',
  savings: 'bg-purple-50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900 text-purple-700 dark:text-purple-300',
  income: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300',
  cost_reduction: 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900 text-amber-700 dark:text-amber-300',
  liquidity: 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900 text-red-700 dark:text-red-300',
};

const TYPE_LABELS = {
  investment: { label: 'Investering', icon: ArrowUpRight },
  savings: { label: 'Sparing', icon: DollarSign },
  income: { label: 'Inntektsøkning', icon: TrendingUp },
  cost_reduction: { label: 'Kostnadsreduksjon', icon: TrendingDown },
  liquidity: { label: 'Likviditetsrisiko', icon: Target },
};

export default function ResourceAllocationAdvisor({ transactions, claims, budgets, teamName }) {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState(null);
  const [membershipInput, setMembershipInput] = useState('');
  const [sponsorInput, setSponsorInput] = useState('');
  const [scenarioResult, setScenarioResult] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);

  const runAllocation = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const byMonth = {};
      transactions.forEach(t => {
        if (!t.date) return;
        const key = t.date.slice(0, 7);
        if (!byMonth[key]) byMonth[key] = { income: 0, expense: 0 };
        if (t.type === 'income') byMonth[key].income += t.amount;
        else byMonth[key].expense += t.amount;
      });

      const months = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
      const surplusMonths = months.filter(([, v]) => v.income - v.expense > 0).map(([k, v]) => ({ month: k, surplus: v.income - v.expense }));
      const shortageMonths = months.filter(([, v]) => v.income - v.expense < 0).map(([k, v]) => ({ month: k, shortage: v.expense - v.income }));

      const totalBalance = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        - transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      const monthlyIncome = transactions.filter(t => {
        if (!t.date) return false;
        return new Date(t.date) >= new Date(now.getFullYear(), now.getMonth() - 3, 1) && t.type === 'income';
      }).reduce((s, t) => s + t.amount, 0) / 3;

      const monthlyExpense = transactions.filter(t => {
        if (!t.date) return false;
        return new Date(t.date) >= new Date(now.getFullYear(), now.getMonth() - 3, 1) && t.type === 'expense';
      }).reduce((s, t) => s + t.amount, 0) / 3;

      const incomeByCategory = {};
      transactions.filter(t => t.type === 'income').forEach(t => {
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
      });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Du er en finansrådgiver spesialisert på norske idrettslag. Gi konkrete ressursallokeringsanbefalinger for ${teamName}.

Finansiell situasjon:
- Total saldo: ${formatNOK(totalBalance)}
- Gj.snitt månedlig inntekt: ${formatNOK(monthlyIncome)}
- Gj.snitt månedlig utgift: ${formatNOK(monthlyExpense)}
- Netto månedlig cashflow: ${formatNOK(monthlyIncome - monthlyExpense)}
- Måneder med overskudd: ${surplusMonths.length} (snitt ${formatNOK(surplusMonths.reduce((s, m) => s + m.surplus, 0) / Math.max(surplusMonths.length, 1))})
- Måneder med underskudd: ${shortageMonths.length}
- Inntektsfordeling: ${JSON.stringify(incomeByCategory)}
- Utestående krav: ${formatNOK(claims.filter(c => c.status !== 'paid').reduce((s, c) => s + c.amount, 0))}

Gi anbefalinger for:
1. Hva laget bør gjøre med kontantoverskudd (investering, reservefond, aktiviteter)
2. Tiltak for underskuddsperioder (spesifikke inntektsøkende aktiviteter eller kostnadsreduksjoner for idrettslag)
3. Optimal ressursallokering fremover

Svar på norsk, vær konkret og praktisk.`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            health_score: { type: 'number' },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['investment', 'savings', 'income', 'cost_reduction', 'liquidity'] },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  estimated_impact: { type: 'string' },
                  timeframe: { type: 'string' },
                  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                },
              },
            },
            surplus_strategy: { type: 'string' },
            shortage_strategy: { type: 'string' },
          },
        },
      });
      setAdvice(result);
    } finally {
      setLoading(false);
    }
  };

  const runScenario = async () => {
    if (!membershipInput && !sponsorInput) return;
    setScenarioLoading(true);
    try {
      const membershipChange = Number(membershipInput) || 0;
      const sponsorChange = Number(sponsorInput) || 0;
      const now = new Date();
      const monthlyIncome = transactions.filter(t => {
        if (!t.date) return false;
        return new Date(t.date) >= new Date(now.getFullYear(), now.getMonth() - 3, 1) && t.type === 'income';
      }).reduce((s, t) => s + t.amount, 0) / 3;
      const monthlyExpense = transactions.filter(t => {
        if (!t.date) return false;
        return new Date(t.date) >= new Date(now.getFullYear(), now.getMonth() - 3, 1) && t.type === 'expense';
      }).reduce((s, t) => s + t.amount, 0) / 3;

      const currentContingent = transactions.filter(t => t.category?.toLowerCase().includes('kontingent') && t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const currentSponsor = transactions.filter(t => t.category?.toLowerCase().includes('sponsor') && t.type === 'income').reduce((s, t) => s + t.amount, 0);

      const newMonthlyContingent = (currentContingent / 12) * (1 + membershipChange / 100);
      const newMonthlySponsor = (currentSponsor / 12) * (1 + sponsorChange / 100);
      const contingentDelta = newMonthlyContingent - currentContingent / 12;
      const sponsorDelta = newMonthlySponsor - currentSponsor / 12;
      const newNetMonthly = monthlyIncome - monthlyExpense + contingentDelta + sponsorDelta;

      setScenarioResult({
        membershipChange,
        sponsorChange,
        contingentDelta,
        sponsorDelta,
        totalMonthlyImpact: contingentDelta + sponsorDelta,
        newNetMonthly,
        annualImpact: (contingentDelta + sponsorDelta) * 12,
        positive: newNetMonthly > (monthlyIncome - monthlyExpense),
      });
    } finally {
      setScenarioLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" />
              AI Ressursallokering
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Anbefalinger for optimal bruk av lagets midler</p>
          </div>
          <Button onClick={runAllocation} disabled={loading} size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Analyser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Scenario simulator */}
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-500" />
            Scenariosimulator – kontingent & sponsor
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Kontingentendring (%)</p>
              <input
                type="number"
                placeholder="f.eks. 10 (= +10%)"
                value={membershipInput}
                onChange={e => setMembershipInput(e.target.value)}
                className="w-full text-sm p-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Sponsorendring (%)</p>
              <input
                type="number"
                placeholder="f.eks. 20 (= +20%)"
                value={sponsorInput}
                onChange={e => setSponsorInput(e.target.value)}
                className="w-full text-sm p-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <Button size="sm" onClick={runScenario} disabled={scenarioLoading} variant="outline" className="gap-2">
            {scenarioLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
            Beregn effekt
          </Button>
          {scenarioResult && (
            <div className={`mt-3 p-3 rounded-lg border text-sm ${scenarioResult.positive ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900' : 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900'}`}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-slate-500">Månedlig effekt</p>
                  <p className={`font-bold ${scenarioResult.totalMonthlyImpact >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {scenarioResult.totalMonthlyImpact >= 0 ? '+' : ''}{formatNOK(scenarioResult.totalMonthlyImpact)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Årlig effekt</p>
                  <p className={`font-bold ${scenarioResult.annualImpact >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {scenarioResult.annualImpact >= 0 ? '+' : ''}{formatNOK(scenarioResult.annualImpact)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ny netto/mnd</p>
                  <p className={`font-bold ${scenarioResult.newNetMonthly >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatNOK(scenarioResult.newNetMonthly)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="font-medium">{scenarioResult.positive ? '✓ Forbedring' : '⚠ Forverring'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI results */}
        {!advice && !loading && (
          <div className="text-center py-6 text-slate-400">
            <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Klikk "Analyser" for AI-anbefalinger om ressursallokering</p>
          </div>
        )}
        {loading && (
          <div className="text-center py-6 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-500" />
            <p className="text-sm">Analyserer ressursbruk og genererer anbefalinger...</p>
          </div>
        )}
        {advice && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900">
              <div className="text-center min-w-[60px]">
                <p className="text-2xl font-bold text-emerald-600">{advice.health_score || 0}</p>
                <p className="text-xs text-slate-500">/ 100</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Finansiell helseskår</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{advice.summary}</p>
              </div>
            </div>

            {advice.surplus_strategy && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">📈 Strategi for overskudd</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{advice.surplus_strategy}</p>
              </div>
            )}

            {advice.shortage_strategy && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">⚠️ Strategi for underskudd</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{advice.shortage_strategy}</p>
              </div>
            )}

            {advice.recommendations?.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Konkrete anbefalinger</p>
                <div className="space-y-2">
                  {advice.recommendations.map((rec, i) => {
                    const typeInfo = TYPE_LABELS[rec.type] || TYPE_LABELS.income;
                    const Icon = typeInfo.icon;
                    return (
                      <div key={i} className={`p-3 rounded-lg border text-sm ${CATEGORY_COLORS[rec.type] || ''}`}>
                        <div className="flex items-start gap-2">
                          <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-semibold">{rec.title}</p>
                              <Badge variant="outline" className="text-xs py-0">{typeInfo.label}</Badge>
                              {rec.priority === 'high' && <Badge className="text-xs py-0 bg-red-500">Høy prioritet</Badge>}
                            </div>
                            <p className="text-xs opacity-80">{rec.description}</p>
                            <div className="flex gap-3 mt-1.5">
                              {rec.estimated_impact && <p className="text-xs font-medium">💡 {rec.estimated_impact}</p>}
                              {rec.timeframe && <p className="text-xs opacity-60">⏱ {rec.timeframe}</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}