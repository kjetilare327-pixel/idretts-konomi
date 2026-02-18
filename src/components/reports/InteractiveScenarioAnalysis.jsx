import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, Area, AreaChart, ComposedChart, Bar
} from 'recharts';
import { TrendingUp, AlertCircle, CheckCircle2, Zap, Sparkles, Loader2, ShieldAlert } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

const HORIZON_OPTIONS = [
  { value: '1', label: '1 år' },
  { value: '2', label: '2 år' },
  { value: '3', label: '3 år' },
];

export default function InteractiveScenarioAnalysis({ teamId, currentFinancials }) {
  const [scenario, setScenario] = useState({
    membershipFeeChange: 0,
    memberGrowth: 0,
    sponsorshipIncrease: 0,
    expenseReduction: 0,
    dugnadsIncome: 0,
    // Makroøkonomiske variabler
    inflation: 3.5,
    interestRate: 4.5,
    memberChurn: 5,
    equipmentCostGrowth: 5,
  });

  const [horizon, setHorizon] = useState('1');
  const [projectedData, setProjectedData] = useState([]);
  const [liquidityData, setLiquidityData] = useState([]);
  const [summary, setSummary] = useState({ projectedRevenue: 0, projectedExpenses: 0, projectedBalance: 0, changePercent: 0 });
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const currentRevenue = currentFinancials?.totalIncome || 0;
  const currentExpenses = currentFinancials?.totalExpenses || 0;
  const currentBalance = currentRevenue - currentExpenses;
  const avgMembershipFee = (currentFinancials?.memberCount || 0) > 0
    ? currentRevenue / currentFinancials.memberCount
    : 5000;

  useEffect(() => {
    calculateProjection();
  }, [scenario, currentFinancials, horizon]);

  const calculateProjection = () => {
    const years = parseInt(horizon);
    const months = years * 12;

    const membershipChange = (scenario.membershipFeeChange / 100) * currentRevenue;
    const newMembersIncome = scenario.memberGrowth * avgMembershipFee;
    const baseNewRevenue = currentRevenue + membershipChange + newMembersIncome + scenario.sponsorshipIncrease + scenario.dugnadsIncome;
    const expenseChange = (scenario.expenseReduction / 100) * currentExpenses;
    const baseNewExpenses = currentExpenses - expenseChange;

    // Inflasjonsjustert vekst per måned
    const monthlyInflation = Math.pow(1 + scenario.inflation / 100, 1 / 12) - 1;
    const monthlyInterestCost = (scenario.interestRate / 100 / 12);
    const monthlyChurn = scenario.memberChurn / 100 / 12;
    const monthlyEquipmentGrowth = Math.pow(1 + scenario.equipmentCostGrowth / 100, 1 / 12) - 1;

    const dataPoints = [];
    const liquidityPoints = [];
    let cumulativeBalance = currentBalance;
    let runningRevenue = baseNewRevenue / 12;
    let runningExpenses = baseNewExpenses / 12;

    for (let i = 0; i <= months; i++) {
      // Inflasjon øker utgifter over tid
      runningExpenses *= (1 + monthlyInflation * 0.7 + monthlyEquipmentGrowth * 0.3);
      // Rentekostnad (hvis negativ balanse)
      const interestCost = cumulativeBalance < 0 ? Math.abs(cumulativeBalance) * monthlyInterestCost : 0;
      // Frafall reduserer inntekter
      runningRevenue *= (1 - monthlyChurn * 0.3);

      const monthlyNet = runningRevenue - runningExpenses - interestCost;
      cumulativeBalance += monthlyNet;

      const label = i === 0 ? 'Nå' : i % 12 === 0 ? `År ${i / 12}` : i <= 12 ? `Mnd ${i}` : null;
      if (label || i % 3 === 0) {
        dataPoints.push({
          label: label || (i % 6 === 0 ? `Mnd ${i}` : ''),
          month: i,
          'Ny saldo (kumulativ)': Math.round(cumulativeBalance),
          'Nåværende (uendret)': Math.round(currentBalance + (currentBalance / 12 * i * 0.01)),
          'Månedlig inntekt': Math.round(runningRevenue),
          'Månedlig utgift': Math.round(runningExpenses + interestCost),
        });

        // Likviditetsanalyse: 3-måneders løpende gjennomsnitt av kontantstrøm
        liquidityPoints.push({
          label: label || (i % 6 === 0 ? `Mnd ${i}` : ''),
          month: i,
          'Kontantbeholdning': Math.round(cumulativeBalance),
          'Kritisk grense': Math.round(runningExpenses * 2), // 2 måneder buffer
          'Anbefalt reserve': Math.round(runningExpenses * 3),
        });
      }
    }

    setProjectedData(dataPoints);
    setLiquidityData(liquidityPoints);

    const finalRevenue = baseNewRevenue * years;
    const finalExpenses = baseNewExpenses * years * (1 + scenario.inflation / 100 * years * 0.5);
    const projectedBalance = cumulativeBalance;
    const changePercent = currentBalance !== 0 ? ((projectedBalance - currentBalance) / Math.abs(currentBalance) * 100) : 0;

    setSummary({ projectedRevenue: finalRevenue, projectedExpenses: finalExpenses, projectedBalance, changePercent });
  };

  const generateAIRecommendations = async () => {
    setLoadingAI(true);
    setAiRecommendations(null);
    const finalLiquidity = liquidityData[liquidityData.length - 1];
    const prompt = `Du er finansiell rådgiver for et idrettslag. Analyser følgende scenarioparametere og gi risikovurdering og konkrete anbefalinger på norsk.

Tidshorisont: ${horizon} år
Nåværende inntekt/år: ${formatNOK(currentRevenue)}
Nåværende utgifter/år: ${formatNOK(currentExpenses)}

Scenariovariable:
- Kontingentendring: ${scenario.membershipFeeChange > 0 ? '+' : ''}${scenario.membershipFeeChange}%
- Nye medlemmer: ${scenario.memberGrowth}
- Sponsorinntekt: ${formatNOK(scenario.sponsorshipIncrease)}
- Utgiftsreduksjon: ${scenario.expenseReduction}%

Makroøkonomiske faktorer:
- Inflasjon: ${scenario.inflation}%
- Rentesats: ${scenario.interestRate}%
- Medlemsfrafall: ${scenario.memberChurn}% per år
- Utstyrskostnadsvekst: ${scenario.equipmentCostGrowth}%

Projisert sluttsaldo etter ${horizon} år: ${formatNOK(summary.projectedBalance)}
Endring fra nå: ${summary.changePercent.toFixed(1)}%
Estimert kontantbeholdning slutten: ${finalLiquidity ? formatNOK(finalLiquidity['Kontantbeholdning']) : 'ukjent'}

Gi:
1. Risikovurdering (lav/middels/høy) med begrunnelse
2. Tre konkrete anbefalinger for å forbedre likviditet
3. To forslag til inntektsdiversifisering
4. En anbefaling for risikostyring (f.eks. reserve, forsikring, bufferbudsjett)`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            risk_level: { type: 'string', enum: ['lav', 'middels', 'høy'] },
            risk_summary: { type: 'string' },
            liquidity_recommendations: { type: 'array', items: { type: 'string' } },
            income_diversification: { type: 'array', items: { type: 'string' } },
            risk_management: { type: 'string' }
          }
        }
      });
      setAiRecommendations(res);
    } catch(e) {
      setAiRecommendations({ error: true });
    } finally {
      setLoadingAI(false);
    }
  };

  const resetScenario = () => setScenario({
    membershipFeeChange: 0, memberGrowth: 0, sponsorshipIncrease: 0,
    expenseReduction: 0, dugnadsIncome: 0,
    inflation: 3.5, interestRate: 4.5, memberChurn: 5, equipmentCostGrowth: 5
  });

  const applyPreset = (preset) => {
    const presets = {
      aggressive: { membershipFeeChange: 15, memberGrowth: 10, sponsorshipIncrease: 50000, expenseReduction: 10, dugnadsIncome: 30000, inflation: 3.5, interestRate: 4.5, memberChurn: 3, equipmentCostGrowth: 5 },
      moderate: { membershipFeeChange: 5, memberGrowth: 5, sponsorshipIncrease: 20000, expenseReduction: 5, dugnadsIncome: 15000, inflation: 3.5, interestRate: 4.5, memberChurn: 5, equipmentCostGrowth: 5 },
      conservative: { membershipFeeChange: 0, memberGrowth: 2, sponsorshipIncrease: 10000, expenseReduction: 3, dugnadsIncome: 5000, inflation: 4.5, interestRate: 5.5, memberChurn: 8, equipmentCostGrowth: 7 },
      pessimistic: { membershipFeeChange: -5, memberGrowth: -5, sponsorshipIncrease: -10000, expenseReduction: 0, dugnadsIncome: 0, inflation: 6.0, interestRate: 6.5, memberChurn: 12, equipmentCostGrowth: 10 },
    };
    setScenario(presets[preset]);
    setAiRecommendations(null);
  };

  const riskColor = { lav: 'bg-emerald-100 text-emerald-800 border-emerald-200', middels: 'bg-amber-100 text-amber-800 border-amber-200', høy: 'bg-red-100 text-red-800 border-red-200' };

  return (
    <div className="space-y-6">
      {/* Preset + horizon */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => applyPreset('conservative')}>Konservativ</Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset('moderate')}>Moderat</Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset('aggressive')}>Aggressiv</Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset('pessimistic')}>Pessimistisk</Button>
          <Button size="sm" variant="ghost" onClick={resetScenario}>Nullstill</Button>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Tidshorisont:</Label>
          <Select value={horizon} onValueChange={v => { setHorizon(v); setAiRecommendations(null); }}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HORIZON_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <Card className="border-0 shadow-md dark:bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Scenariovariable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'membershipFeeChange', label: 'Kontingentendring', min: -50, max: 50, step: 5, suffix: '%', impact: (v) => formatNOK((v/100)*currentRevenue) },
                { key: 'memberGrowth', label: 'Nye/tapte medlemmer', min: -30, max: 50, step: 1, suffix: '', impact: (v) => formatNOK(v*avgMembershipFee) },
                { key: 'expenseReduction', label: 'Utgiftsreduksjon', min: 0, max: 30, step: 1, suffix: '%', impact: (v) => formatNOK((v/100)*currentExpenses) },
              ].map(({ key, label, min, max, step, suffix, impact }) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <Label className="text-xs">{label}</Label>
                    <span className="font-medium text-xs">{scenario[key] > 0 ? '+' : ''}{scenario[key]}{suffix}</span>
                  </div>
                  <Slider value={[scenario[key]]} onValueChange={([v]) => setScenario({...scenario, [key]: v})} min={min} max={max} step={step} className="py-1" />
                  <p className="text-xs text-slate-400">Effekt: {impact(scenario[key])}</p>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div>
                  <Label className="text-xs">Sponsorinntekt (NOK)</Label>
                  <Input type="number" value={scenario.sponsorshipIncrease} onChange={e => setScenario({...scenario, sponsorshipIncrease: parseFloat(e.target.value)||0})} className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Dugnadsintekt (NOK)</Label>
                  <Input type="number" value={scenario.dugnadsIncome} onChange={e => setScenario({...scenario, dugnadsIncome: parseFloat(e.target.value)||0})} className="h-8 text-sm mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md dark:bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Makroøkonomi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'inflation', label: 'Inflasjon', min: 0, max: 15, step: 0.5, suffix: '%' },
                { key: 'interestRate', label: 'Rentesats', min: 0, max: 15, step: 0.5, suffix: '%' },
                { key: 'memberChurn', label: 'Årlig frafall', min: 0, max: 30, step: 1, suffix: '%' },
                { key: 'equipmentCostGrowth', label: 'Utstyrsprisvekst', min: 0, max: 20, step: 0.5, suffix: '%' },
              ].map(({ key, label, min, max, step, suffix }) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{label}</Label>
                    <span className="text-xs font-medium">{scenario[key]}{suffix}</span>
                  </div>
                  <Slider value={[scenario[key]]} onValueChange={([v]) => setScenario({...scenario, [key]: v})} min={min} max={max} step={step} className="py-1" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100">
              <p className="text-xs text-slate-500 mb-1">Projisert inntekt ({horizon}år)</p>
              <p className="text-xl font-bold text-emerald-700">{formatNOK(summary.projectedRevenue)}</p>
            </div>
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100">
              <p className="text-xs text-slate-500 mb-1">Projisert utgift ({horizon}år)</p>
              <p className="text-xl font-bold text-red-700">{formatNOK(summary.projectedExpenses)}</p>
            </div>
            <div className={`p-4 rounded-xl border ${summary.projectedBalance >= 0 ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-100'}`}>
              <p className="text-xs text-slate-500 mb-1">Sluttsaldo</p>
              <p className={`text-xl font-bold ${summary.projectedBalance >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>
                {formatNOK(summary.projectedBalance)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{summary.changePercent > 0 ? '+' : ''}{summary.changePercent.toFixed(1)}% vs nå</p>
            </div>
          </div>

          {/* Charts */}
          <Tabs defaultValue="balance">
            <TabsList>
              <TabsTrigger value="balance">Saldoutvikling</TabsTrigger>
              <TabsTrigger value="liquidity">Likviditetsanalyse</TabsTrigger>
              <TabsTrigger value="cashflow">Kontantstrøm</TabsTrigger>
            </TabsList>

            <TabsContent value="balance">
              <Card className="border-0 shadow-md dark:bg-slate-900">
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={projectedData.filter(d => d.label)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => formatNOK(v)} />
                      <Legend />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="Nåværende (uendret)" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                      <Line type="monotone" dataKey="Ny saldo (kumulativ)" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="liquidity">
              <Card className="border-0 shadow-md dark:bg-slate-900">
                <CardHeader className="pb-2">
                  <CardDescription>Prediktiv likviditetsanalyse – sammenligner kontantbeholdning mot kritisk grense (2 mnd reserve) og anbefalt reserve (3 mnd)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={liquidityData.filter(d => d.label)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => formatNOK(v)} />
                      <Legend />
                      <Area type="monotone" dataKey="Kontantbeholdning" fill="#dbeafe" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.4} />
                      <Line type="monotone" dataKey="Kritisk grense" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="6 3" />
                      <Line type="monotone" dataKey="Anbefalt reserve" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cashflow">
              <Card className="border-0 shadow-md dark:bg-slate-900">
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={projectedData.filter(d => d.label)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => formatNOK(v)} />
                      <Legend />
                      <Bar dataKey="Månedlig inntekt" fill="#10b981" opacity={0.7} />
                      <Bar dataKey="Månedlig utgift" fill="#f43f5e" opacity={0.7} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* AI Recommendations */}
          <Card className="border-0 shadow-md dark:bg-slate-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    AI Risiko & Anbefalinger
                  </CardTitle>
                  <CardDescription>Risikovurdering og diversifiseringsstrategier basert på scenariovariablene dine</CardDescription>
                </div>
                <Button onClick={generateAIRecommendations} disabled={loadingAI} size="sm" variant="outline" className="gap-2">
                  {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loadingAI ? 'Analyserer...' : 'Analyser risiko'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!aiRecommendations && !loadingAI && (
                <p className="text-sm text-slate-500 text-center py-4">Klikk «Analyser risiko» for AI-baserte anbefalinger for dette scenariet.</p>
              )}
              {loadingAI && (
                <div className="text-center py-4">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto text-purple-500 mb-2" />
                  <p className="text-sm text-slate-500">AI vurderer risiko og genererer anbefalinger...</p>
                </div>
              )}
              {aiRecommendations && !aiRecommendations.error && (
                <div className="space-y-4">
                  <div className={`flex items-start gap-3 p-4 rounded-lg border ${riskColor[aiRecommendations.risk_level] || 'bg-slate-50 border-slate-200'}`}>
                    <ShieldAlert className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm">Risikonivå: {aiRecommendations.risk_level?.toUpperCase()}</span>
                      </div>
                      <p className="text-sm">{aiRecommendations.risk_summary}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Likviditetsanbefalinger</h4>
                      <ul className="space-y-2">
                        {aiRecommendations.liquidity_recommendations?.map((r, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5 p-2 bg-blue-50 dark:bg-blue-950/20 rounded"><span className="text-blue-500">→</span>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1"><Zap className="w-3 h-3" />Inntektsdiversifisering</h4>
                      <ul className="space-y-2">
                        {aiRecommendations.income_diversification?.map((r, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5 p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded"><span className="text-emerald-500">+</span>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Risikostyring</h4>
                      <p className="text-xs p-2 bg-purple-50 dark:bg-purple-950/20 rounded">{aiRecommendations.risk_management}</p>
                    </div>
                  </div>
                </div>
              )}
              {aiRecommendations?.error && (
                <p className="text-sm text-red-500 text-center py-2">Kunne ikke hente AI-anbefalinger. Prøv igjen.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}