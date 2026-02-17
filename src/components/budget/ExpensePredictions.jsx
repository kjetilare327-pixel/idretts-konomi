import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function ExpensePredictions({ teamId }) {
  const [months, setMonths] = useState('3');
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);

  const handlePredict = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('predictExpenses', {
        teamId,
        months: parseInt(months)
      });
      setPrediction(response.data);
    } catch (error) {
      console.error('Prediction failed:', error);
      alert('Kunne ikke generere prognoser');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">AI-drevet utgiftsprognose</CardTitle>
            <CardDescription>
              Forutsi fremtidige utgifter og motta proaktive budsjettvarsler
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 måned</SelectItem>
                <SelectItem value="3">3 måneder</SelectItem>
                <SelectItem value="6">6 måneder</SelectItem>
                <SelectItem value="12">12 måneder</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={handlePredict}
              disabled={loading}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyserer...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Generer prognose
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!prediction ? (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400">
              Klikk "Generer prognose" for å få AI-drevne utgiftsprognoser
            </p>
          </div>
        ) : (
          <>
            {/* Budget Alerts */}
            {prediction.budget_alerts?.length > 0 && (
              <div className="space-y-3">
                {prediction.budget_alerts.map((alert, i) => (
                  <Alert 
                    key={i}
                    className={
                      alert.severity === 'high' 
                        ? 'border-red-200 bg-red-50 dark:bg-red-900/20'
                        : alert.severity === 'medium'
                        ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-blue-200 bg-blue-50 dark:bg-blue-900/20'
                    }
                  >
                    <AlertTriangle className={`w-4 h-4 ${
                      alert.severity === 'high' ? 'text-red-600' :
                      alert.severity === 'medium' ? 'text-amber-600' :
                      'text-blue-600'
                    }`} />
                    <AlertDescription>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{alert.category}</Badge>
                          <span className="font-medium">{alert.message}</span>
                        </div>
                        <p className="text-sm">{alert.recommendation}</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-slate-900">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Forventet totalutgift</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatNOK(prediction.summary?.total_predicted || 0)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Budsjettavvik</p>
                <p className={`text-2xl font-bold ${
                  (prediction.summary?.budget_variance || 0) > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}>
                  {formatNOK(prediction.summary?.budget_variance || 0)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Høyrisiko-kategorier</p>
                <p className="text-2xl font-bold text-amber-600">
                  {prediction.summary?.high_risk_categories?.length || 0}
                </p>
              </div>
            </div>

            {/* Monthly Predictions */}
            {prediction.predictions?.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Månedlige prognoser</h3>
                {prediction.predictions.map((pred, i) => (
                  <div key={i} className="p-4 rounded-lg border bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">
                        {new Date(pred.month + '-01').toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })}
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(pred.categories || {}).map(([category, data]) => (
                        <div key={category} className="p-3 rounded bg-slate-50 dark:bg-slate-800">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-sm font-medium">{category}</span>
                            <Badge 
                              variant="outline" 
                              className={
                                data.confidence === 'high' ? 'border-emerald-600 text-emerald-600' :
                                data.confidence === 'medium' ? 'border-amber-600 text-amber-600' :
                                'border-slate-600 text-slate-600'
                              }
                            >
                              {data.confidence}
                            </Badge>
                          </div>
                          <p className="text-lg font-bold">{formatNOK(data.predicted)}</p>
                          {data.trend && (
                            <p className="text-xs text-slate-500 mt-1">Trend: {data.trend}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}