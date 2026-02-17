import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, TrendingUp, TrendingDown, Plus, Check } from 'lucide-react';
import { formatNOK } from '../shared/FormatUtils';

export default function AiBudgetGenerator({ teamId }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const queryClient = useQueryClient();

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('generateBudgetSuggestions', { team_id: teamId });
      setSuggestions(response.data);
      setShowDialog(true);
    } catch (error) {
      alert('Feil ved generering: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const applyBudget = async (budget) => {
    try {
      await base44.entities.Budget.create({
        team_id: teamId,
        category: budget.category,
        type: budget.type,
        monthly_amount: budget.monthly_amount,
        yearly_amount: budget.yearly_amount,
        period: 'monthly'
      });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } catch (error) {
      alert('Feil ved lagring: ' + error.message);
    }
  };

  return (
    <>
      <Button 
        onClick={generateSuggestions} 
        disabled={loading}
        className="gap-2 bg-purple-600 hover:bg-purple-700"
      >
        <Sparkles className="w-4 h-4" />
        {loading ? 'Genererer...' : 'Generer AI-budsjett'}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI-genererte budsjettforslag
            </DialogTitle>
          </DialogHeader>

          {suggestions && (
            <div className="space-y-6 pt-4">
              {/* Budget suggestions */}
              <div className="space-y-3">
                <h3 className="font-semibold">Foreslåtte budsjetter basert på historikk</h3>
                {suggestions.budget_suggestions?.map((budget, idx) => (
                  <Card key={idx} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{budget.category}</h4>
                            <Badge variant={budget.type === 'income' ? 'default' : 'outline'}>
                              {budget.type === 'income' ? 'Inntekt' : 'Utgift'}
                            </Badge>
                            <Badge className={
                              budget.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                              budget.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }>
                              {budget.confidence === 'high' ? 'Høy sikkerhet' :
                               budget.confidence === 'medium' ? 'Middels sikkerhet' : 'Lav sikkerhet'}
                            </Badge>
                          </div>
                          <div className="flex gap-4 text-sm text-slate-600">
                            <span>Månedlig: {formatNOK(budget.monthly_amount)}</span>
                            <span>•</span>
                            <span>Historisk snitt: {formatNOK(budget.historical_average)}</span>
                            <span>•</span>
                            <span>{budget.transaction_count} transaksjoner</span>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => applyBudget(budget)} className="gap-2">
                          <Plus className="w-4 h-4" />
                          Legg til
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* AI recommendations */}
              {suggestions.ai_recommendations?.adjustments?.length > 0 && (
                <Card className="border-2 border-purple-200 dark:border-purple-900">
                  <CardHeader>
                    <CardTitle className="text-base">AI-anbefalinger for justeringer</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {suggestions.ai_recommendations.adjustments.map((adj, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                        <div className="flex items-start gap-2">
                          <TrendingUp className="w-4 h-4 text-purple-600 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{adj.category}</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{adj.recommendation}</p>
                            {adj.suggested_amount && (
                              <p className="text-xs text-purple-600 mt-1">
                                Foreslått: {formatNOK(adj.suggested_amount)}/mnd
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* New categories */}
              {suggestions.ai_recommendations?.new_categories?.length > 0 && (
                <Card className="border-2 border-blue-200 dark:border-blue-900">
                  <CardHeader>
                    <CardTitle className="text-base">Foreslåtte nye budsjettkategorier</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {suggestions.ai_recommendations.new_categories.map((cat, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{cat.category}</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{cat.reason}</p>
                            <p className="text-xs text-blue-600 mt-1">
                              {formatNOK(cat.suggested_amount)}/mnd
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => applyBudget({
                              category: cat.category,
                              type: cat.type,
                              monthly_amount: cat.suggested_amount,
                              yearly_amount: cat.suggested_amount * 12
                            })}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Savings opportunities */}
              {suggestions.ai_recommendations?.savings_opportunities?.length > 0 && (
                <Card className="border-2 border-emerald-200 dark:border-emerald-900">
                  <CardHeader>
                    <CardTitle className="text-base">Innsparingsmuligheter</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {suggestions.ai_recommendations.savings_opportunities.map((opp, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                        <div className="flex items-start gap-2">
                          <TrendingDown className="w-4 h-4 text-emerald-600 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm">{opp.area}</h4>
                              <Badge className="bg-emerald-100 text-emerald-700">
                                Spar {formatNOK(opp.potential_savings)}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{opp.action}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}