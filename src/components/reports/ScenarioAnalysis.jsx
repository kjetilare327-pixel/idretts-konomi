import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calculator, Loader2 } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function ScenarioAnalysis({ teamId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [scenario, setScenario] = useState({
    income_change_percent: 0,
    expense_change_percent: 0,
    new_members: 0,
    membership_fee: 0,
    description: ''
  });

  const analyzeScenario = async () => {
    setLoading(true);
    
    try {
      const response = await base44.functions.invoke('predictFinancialTrends', { 
        team_id: teamId,
        scenario: {
          income_change: scenario.income_change_percent,
          expense_change: scenario.expense_change_percent,
          new_members: scenario.new_members,
          membership_fee: scenario.membership_fee,
          description: scenario.description || `Inntekt ${scenario.income_change_percent >= 0 ? '+' : ''}${scenario.income_change_percent}%, Utgift ${scenario.expense_change_percent >= 0 ? '+' : ''}${scenario.expense_change_percent}%, ${scenario.new_members} nye medlemmer`
        }
      });
      setResult(response.data.forecast);
    } catch (err) {
      console.error('Scenario analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="w-6 h-6 text-purple-500" />
          <CardTitle>Hva-om Scenarioanalyse</CardTitle>
        </div>
        <CardDescription>
          Simuler endringer i inntekter og utgifter for å se fremtidig påvirkning
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scenario inputs */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Inntektsendring (%): {scenario.income_change_percent > 0 ? '+' : ''}{scenario.income_change_percent}%</Label>
            <Slider
              value={[scenario.income_change_percent]}
              onValueChange={([val]) => setScenario({...scenario, income_change_percent: val})}
              min={-50}
              max={50}
              step={5}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label>Utgiftsendring (%): {scenario.expense_change_percent > 0 ? '+' : ''}{scenario.expense_change_percent}%</Label>
            <Slider
              value={[scenario.expense_change_percent]}
              onValueChange={([val]) => setScenario({...scenario, expense_change_percent: val})}
              min={-50}
              max={50}
              step={5}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nye medlemmer</Label>
              <Input
                type="number"
                value={scenario.new_members}
                onChange={(e) => setScenario({...scenario, new_members: parseInt(e.target.value) || 0})}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Kontingent per medlem (kr)</Label>
              <Input
                type="number"
                value={scenario.membership_fee}
                onChange={(e) => setScenario({...scenario, membership_fee: parseInt(e.target.value) || 0})}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Beskrivelse (valgfritt)</Label>
            <Input
              value={scenario.description}
              onChange={(e) => setScenario({...scenario, description: e.target.value})}
              placeholder="F.eks. 'Økning pga. ny sponsoravtale'"
            />
          </div>

          <Button 
            onClick={analyzeScenario} 
            disabled={loading}
            className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyserer...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                Analyser scenario
              </>
            )}
          </Button>
        </div>

        {/* Results */}
        {result && result.scenario_impact && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-lg">Resultat</h3>
            <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950/30">
              <AlertDescription className="text-sm">
                {result.scenario_impact.description}
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-xs text-slate-500 mb-1">Finansiell endring</p>
                <p className={`text-2xl font-bold ${result.scenario_impact.financial_change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {result.scenario_impact.financial_change >= 0 ? '+' : ''}
                  {formatNOK(result.scenario_impact.financial_change)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-xs text-slate-500 mb-1">Gjennomførbarhet</p>
                <p className="text-lg font-semibold">{result.scenario_impact.feasibility}</p>
              </div>
            </div>

            {result.key_predictions && (
              <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200">
                <p className="text-sm font-medium mb-2">Med dette scenariet:</p>
                <div className="space-y-1 text-sm">
                  <p>• Årsinntekt: {formatNOK(result.key_predictions.total_year_income)}</p>
                  <p>• Årsutgift: {formatNOK(result.key_predictions.total_year_expense)}</p>
                  <p className={result.key_predictions.expected_surplus_deficit >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                    • Netto: {formatNOK(result.key_predictions.expected_surplus_deficit)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}