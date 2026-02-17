import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target, Zap } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function AiBudgetPlanner({ teamId, onApplyBudget }) {
  const [loading, setLoading] = useState(false);
  const [budgetPlan, setBudgetPlan] = useState(null);
  const [error, setError] = useState(null);

  const generatePlan = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await base44.functions.invoke('suggestBudgetPlan', { team_id: teamId });
      setBudgetPlan(response.data);
    } catch (err) {
      setError(err.message || 'Kunne ikke generere budsjettplan');
      console.error('Budget planning error:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyBudgets = async () => {
    if (!budgetPlan?.budget_plan?.recommended_budgets) return;
    
    for (const budget of budgetPlan.budget_plan.recommended_budgets) {
      try {
        await base44.entities.Budget.create({
          team_id: teamId,
          category: budget.category,
          type: budget.type,
          monthly_amount: budget.monthly_amount,
          yearly_amount: budget.yearly_amount,
          period: 'monthly'
        });
      } catch (err) {
        console.error(`Failed to create budget for ${budget.category}:`, err);
      }
    }
    
    if (onApplyBudget) onApplyBudget();
    alert('Budsjettforslag anvendt!');
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardContent className="p-12 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-4" />
          <p className="text-lg font-medium">Analyserer historikk og genererer budsjettplan...</p>
          <p className="text-sm text-slate-500 mt-2">Dette kan ta noen sekunder</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardContent className="p-6">
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
            <AlertDescription className="text-red-800 dark:text-red-200">
              {error}
            </AlertDescription>
          </Alert>
          <Button onClick={generatePlan} className="mt-4 gap-2">
            <Sparkles className="w-4 h-4" />
            Prøv på nytt
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!budgetPlan) {
    return (
      <Card className="border-0 shadow-md dark:bg-slate-900 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <CardTitle>AI Budsjettplanlegger</CardTitle>
          </div>
          <CardDescription>
            La AI analysere historiske data og foreslå optimalt budsjett
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generatePlan} size="lg" className="gap-2 bg-purple-600 hover:bg-purple-700">
            <Sparkles className="w-5 h-5" />
            Generer AI-budsjettplan
          </Button>
        </CardContent>
      </Card>
    );
  }

  const plan = budgetPlan.budget_plan;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="border-0 shadow-md dark:bg-slate-900 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-500" />
              <CardTitle>AI Budsjettanalyse</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={generatePlan} size="sm">
                Oppdater
              </Button>
              <Button onClick={applyBudgets} size="sm" className="gap-2 bg-purple-600 hover:bg-purple-700">
                <CheckCircle2 className="w-4 h-4" />
                Bruk forslag
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {plan.summary && (
            <div className="p-4 rounded-lg bg-white/50 dark:bg-black/20">
              <p className="text-sm leading-relaxed">{plan.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liquidity Forecast */}
      {plan.liquidity_forecast && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Likviditetsprognose
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <p className="text-xs text-slate-500 mb-1">3 måneder</p>
                <p className="text-xl font-bold text-blue-600">
                  {formatNOK(plan.liquidity_forecast.next_3_months)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
                <p className="text-xs text-slate-500 mb-1">6 måneder</p>
                <p className="text-xl font-bold text-indigo-600">
                  {formatNOK(plan.liquidity_forecast.next_6_months)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                <p className="text-xs text-slate-500 mb-1">12 måneder</p>
                <p className="text-xl font-bold text-purple-600">
                  {formatNOK(plan.liquidity_forecast.next_12_months)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={
                plan.liquidity_forecast.risk_level === 'low' ? 'bg-emerald-100 text-emerald-700' :
                plan.liquidity_forecast.risk_level === 'medium' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }>
                Risiko: {plan.liquidity_forecast.risk_level === 'low' ? 'Lav' : plan.liquidity_forecast.risk_level === 'medium' ? 'Middels' : 'Høy'}
              </Badge>
              <p className="text-sm text-slate-600 dark:text-slate-400">{plan.liquidity_forecast.description}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended Budgets */}
      {plan.recommended_budgets && plan.recommended_budgets.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base">Anbefalte budsjetter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plan.recommended_budgets.map((budget, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{budget.category}</h3>
                        <Badge variant="outline" className="text-xs">
                          {budget.type === 'income' ? 'Inntekt' : 'Utgift'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{budget.reasoning}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Månedlig: {formatNOK(budget.monthly_amount)}</span>
                        <span>Årlig: {formatNOK(budget.yearly_amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optimization Opportunities */}
      {plan.optimization_opportunities && plan.optimization_opportunities.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Sparemuligheter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plan.optimization_opportunities.map((opp, idx) => (
                <div key={idx} className={`p-4 rounded-lg border ${
                  opp.priority === 'high' ? 'border-red-200 bg-red-50 dark:bg-red-950/30' :
                  opp.priority === 'medium' ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/30' :
                  'border-blue-200 bg-blue-50 dark:bg-blue-950/30'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{opp.area}</h3>
                    <Badge className={
                      opp.priority === 'high' ? 'bg-red-100 text-red-700' :
                      opp.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }>
                      {opp.priority === 'high' ? 'Høy prioritet' : opp.priority === 'medium' ? 'Middels' : 'Lav'}
                    </Badge>
                  </div>
                  <p className="text-sm mb-2">{opp.action}</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      Nåværende: {formatNOK(opp.current_spend)}
                    </span>
                    <span className="font-semibold text-emerald-600">
                      Mulig besparelse: {formatNOK(opp.potential_savings)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {plan.recommendations && plan.recommendations.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base">Handlingsanbefalinger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plan.recommendations.map((rec, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
                  <h3 className="font-semibold mb-1">{rec.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{rec.description}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Påvirkning: {rec.impact === 'high' ? 'Høy' : rec.impact === 'medium' ? 'Middels' : 'Lav'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Innsats: {rec.effort === 'high' ? 'Høy' : rec.effort === 'medium' ? 'Middels' : 'Lav'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}