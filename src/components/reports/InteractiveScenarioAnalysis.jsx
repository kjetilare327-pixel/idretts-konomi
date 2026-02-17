import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { TrendingUp, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function InteractiveScenarioAnalysis({ teamId, currentFinancials }) {
  const [scenario, setScenario] = useState({
    membershipFeeChange: 0, // Prosentvis endring
    memberGrowth: 0, // Antall nye medlemmer
    sponsorshipIncrease: 0, // NOK økning
    expenseReduction: 0, // Prosentvis reduksjon
    dugnadsIncome: 0, // NOK fra dugnad
  });

  const [projectedData, setProjectedData] = useState([]);
  const [summary, setSummary] = useState({
    projectedRevenue: 0,
    projectedExpenses: 0,
    projectedBalance: 0,
    changePercent: 0
  });

  const currentRevenue = currentFinancials?.totalIncome || 0;
  const currentExpenses = currentFinancials?.totalExpenses || 0;
  const currentBalance = currentRevenue - currentExpenses;
  const currentMembers = currentFinancials?.memberCount || 0;
  const avgMembershipFee = currentMembers > 0 ? currentRevenue / currentMembers : 5000;

  useEffect(() => {
    calculateProjection();
  }, [scenario, currentFinancials]);

  const calculateProjection = () => {
    // Beregn nye inntekter
    const membershipChange = (scenario.membershipFeeChange / 100) * currentRevenue;
    const newMembersIncome = scenario.memberGrowth * avgMembershipFee;
    const newRevenue = currentRevenue + membershipChange + newMembersIncome + scenario.sponsorshipIncrease + scenario.dugnadsIncome;

    // Beregn nye utgifter
    const expenseChange = (scenario.expenseReduction / 100) * currentExpenses;
    const newExpenses = currentExpenses - expenseChange;

    const newBalance = newRevenue - newExpenses;
    const changePercent = currentBalance !== 0 ? ((newBalance - currentBalance) / Math.abs(currentBalance) * 100) : 0;

    setSummary({
      projectedRevenue: newRevenue,
      projectedExpenses: newExpenses,
      projectedBalance: newBalance,
      changePercent: changePercent
    });

    // Generer månedlig projeksjonsdata
    const months = [];
    for (let i = 0; i <= 12; i++) {
      const monthlyRevenue = newRevenue / 12 * i;
      const monthlyExpenses = newExpenses / 12 * i;
      const currentMonthlyRevenue = currentRevenue / 12 * i;
      const currentMonthlyExpenses = currentExpenses / 12 * i;

      months.push({
        month: `Mnd ${i}`,
        'Nåværende saldo': currentMonthlyRevenue - currentMonthlyExpenses,
        'Ny saldo': monthlyRevenue - monthlyExpenses,
        'Nåværende inntekt': currentMonthlyRevenue,
        'Ny inntekt': monthlyRevenue,
      });
    }

    setProjectedData(months);
  };

  const resetScenario = () => {
    setScenario({
      membershipFeeChange: 0,
      memberGrowth: 0,
      sponsorshipIncrease: 0,
      expenseReduction: 0,
      dugnadsIncome: 0,
    });
  };

  const applyPreset = (preset) => {
    const presets = {
      aggressive: {
        membershipFeeChange: 15,
        memberGrowth: 10,
        sponsorshipIncrease: 50000,
        expenseReduction: 10,
        dugnadsIncome: 30000,
      },
      moderate: {
        membershipFeeChange: 5,
        memberGrowth: 5,
        sponsorshipIncrease: 20000,
        expenseReduction: 5,
        dugnadsIncome: 15000,
      },
      conservative: {
        membershipFeeChange: 0,
        memberGrowth: 2,
        sponsorshipIncrease: 10000,
        expenseReduction: 3,
        dugnadsIncome: 5000,
      }
    };
    setScenario(presets[preset]);
  };

  return (
    <div className="space-y-6">
      {/* Preset buttons */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => applyPreset('conservative')}>
          Konservativ vekst
        </Button>
        <Button size="sm" variant="outline" onClick={() => applyPreset('moderate')}>
          Moderat vekst
        </Button>
        <Button size="sm" variant="outline" onClick={() => applyPreset('aggressive')}>
          Aggressiv vekst
        </Button>
        <Button size="sm" variant="outline" onClick={resetScenario}>
          Nullstill
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle>Juster parametere</CardTitle>
            <CardDescription>Dra i glidebrytere for å se umiddelbar effekt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Kontingentendring</Label>
                <span className="text-sm font-medium">{scenario.membershipFeeChange > 0 ? '+' : ''}{scenario.membershipFeeChange}%</span>
              </div>
              <Slider
                value={[scenario.membershipFeeChange]}
                onValueChange={([v]) => setScenario({...scenario, membershipFeeChange: v})}
                min={-50}
                max={50}
                step={5}
                className="py-2"
              />
              <p className="text-xs text-slate-500">
                Innvirkning: {formatNOK((scenario.membershipFeeChange / 100) * currentRevenue)}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Nye medlemmer</Label>
                <span className="text-sm font-medium">{scenario.memberGrowth}</span>
              </div>
              <Slider
                value={[scenario.memberGrowth]}
                onValueChange={([v]) => setScenario({...scenario, memberGrowth: v})}
                min={0}
                max={50}
                step={1}
                className="py-2"
              />
              <p className="text-xs text-slate-500">
                Innvirkning: {formatNOK(scenario.memberGrowth * avgMembershipFee)}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Sponsorinntekt</Label>
                <Input
                  type="number"
                  value={scenario.sponsorshipIncrease}
                  onChange={(e) => setScenario({...scenario, sponsorshipIncrease: parseFloat(e.target.value) || 0})}
                  className="w-32 h-8 text-sm"
                  placeholder="NOK"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Utgiftsreduksjon</Label>
                <span className="text-sm font-medium">{scenario.expenseReduction}%</span>
              </div>
              <Slider
                value={[scenario.expenseReduction]}
                onValueChange={([v]) => setScenario({...scenario, expenseReduction: v})}
                min={0}
                max={30}
                step={1}
                className="py-2"
              />
              <p className="text-xs text-slate-500">
                Innvirkning: {formatNOK((scenario.expenseReduction / 100) * currentExpenses)}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Dugnadsinntekt</Label>
                <Input
                  type="number"
                  value={scenario.dugnadsIncome}
                  onChange={(e) => setScenario({...scenario, dugnadsIncome: parseFloat(e.target.value) || 0})}
                  className="w-32 h-8 text-sm"
                  placeholder="NOK"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle>Projisert resultat</CardTitle>
            <CardDescription>12-måneders prognose basert på dine justeringer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Projisert inntekt</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatNOK(summary.projectedRevenue)}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Nåværende: {formatNOK(currentRevenue)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-500 opacity-30" />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-red-50 dark:bg-red-950/30">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Projisert utgift</p>
                  <p className="text-2xl font-bold text-red-600">{formatNOK(summary.projectedExpenses)}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Nåværende: {formatNOK(currentExpenses)}
                  </p>
                </div>
                <Zap className="w-8 h-8 text-red-500 opacity-30" />
              </div>

              <div className={`flex items-center justify-between p-4 rounded-lg ${
                summary.projectedBalance >= 0 
                  ? 'bg-indigo-50 dark:bg-indigo-950/30' 
                  : 'bg-amber-50 dark:bg-amber-950/30'
              }`}>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Netto saldo</p>
                  <p className={`text-3xl font-bold ${
                    summary.projectedBalance >= 0 ? 'text-indigo-600' : 'text-amber-600'
                  }`}>
                    {formatNOK(summary.projectedBalance)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {summary.changePercent >= 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <p className="text-xs text-slate-500">
                      {summary.changePercent > 0 ? '+' : ''}{summary.changePercent.toFixed(1)}% vs. nåværende
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle>Visuell sammenligning</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={projectedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(val) => formatNOK(val)} />
              <Legend />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="Nåværende saldo" stroke="#94a3b8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Ny saldo" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}