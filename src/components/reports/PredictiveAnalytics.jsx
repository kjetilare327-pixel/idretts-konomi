import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Loader2, AlertTriangle, Lightbulb, Target } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function PredictiveAnalytics({ teamId }) {
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState(null);

  const generateForecast = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await base44.functions.invoke('predictFinancialTrends', { team_id: teamId });
      setForecast(response.data);
    } catch (err) {
      setError(err.message || 'Kunne ikke generere prognose');
      console.error('Forecast error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardContent className="p-12 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
          <p className="text-lg font-medium">Genererer finansiell prognose...</p>
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
          <Button onClick={generateForecast} className="mt-4 gap-2">
            <TrendingUp className="w-4 h-4" />
            Prøv på nytt
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!forecast) {
    return (
      <Card className="border-0 shadow-md dark:bg-slate-900 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-500" />
            <CardTitle>Prediktiv Analyse</CardTitle>
          </div>
          <CardDescription>
            AI-drevet finansiell prognose og risikoanalyse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generateForecast} size="lg" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <TrendingUp className="w-5 h-5" />
            Generer prognose
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = forecast.forecast;
  const chartData = data.monthly_forecast?.map(m => ({
    month: m.month.split('-')[1] + '/' + m.month.split('-')[0].slice(2),
    income: m.predicted_income,
    expense: m.predicted_expense,
    net: m.predicted_net
  })) || [];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="border-0 shadow-md dark:bg-slate-900 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-500" />
              <CardTitle>Finansiell Prognose</CardTitle>
            </div>
            <Button variant="outline" onClick={generateForecast} size="sm">
              Oppdater
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.summary && (
            <p className="text-sm leading-relaxed mb-4">{data.summary}</p>
          )}
          {data.key_predictions && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20">
                <p className="text-xs text-slate-500 mb-1">Forventet årsinntekt</p>
                <p className="text-lg font-bold text-emerald-600">
                  {formatNOK(data.key_predictions.total_year_income)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20">
                <p className="text-xs text-slate-500 mb-1">Forventet årsutgift</p>
                <p className="text-lg font-bold text-red-600">
                  {formatNOK(data.key_predictions.total_year_expense)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20">
                <p className="text-xs text-slate-500 mb-1">Overskudd/Underskudd</p>
                <p className={`text-lg font-bold ${data.key_predictions.expected_surplus_deficit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatNOK(data.key_predictions.expected_surplus_deficit)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forecast Chart */}
      {chartData.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base">12-måneders prognose</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(val) => formatNOK(val)} />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#10b981" name="Inntekt" strokeWidth={2} />
                <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Utgift" strokeWidth={2} />
                <Line type="monotone" dataKey="net" stroke="#6366f1" name="Netto" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Risks */}
      {data.risks && data.risks.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Risikoer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.risks.map((risk, idx) => (
                <div key={idx} className={`p-4 rounded-lg border ${
                  risk.probability === 'high' ? 'border-red-200 bg-red-50 dark:bg-red-950/30' :
                  risk.probability === 'medium' ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/30' :
                  'border-blue-200 bg-blue-50 dark:bg-blue-950/30'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{risk.risk}</h3>
                    <Badge className={
                      risk.probability === 'high' ? 'bg-red-100 text-red-700' :
                      risk.probability === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }>
                      {risk.probability === 'high' ? 'Høy sannsynlighet' : risk.probability === 'medium' ? 'Middels' : 'Lav'}
                    </Badge>
                  </div>
                  <p className="text-sm mb-2">Påvirkning: {formatNOK(risk.impact)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">→ {risk.mitigation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opportunities */}
      {data.opportunities && data.opportunities.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Muligheter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.opportunities.map((opp, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
                  <h3 className="font-semibold mb-1">{opp.opportunity}</h3>
                  <div className="flex items-center gap-4 text-sm mb-2">
                    <span className="font-semibold text-emerald-600">+{formatNOK(opp.potential_value)}</span>
                    <Badge variant="outline" className="text-xs">
                      Innsats: {opp.effort === 'low' ? 'Lav' : opp.effort === 'medium' ? 'Middels' : 'Høy'}
                    </Badge>
                    <span className="text-xs text-slate-500">{opp.timeline}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              Handlingsanbefalinger
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recommendations.map((rec, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{rec.action}</h3>
                    <Badge className={
                      rec.priority === 'critical' ? 'bg-red-100 text-red-700' :
                      rec.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }>
                      {rec.priority === 'critical' ? 'Kritisk' : rec.priority === 'high' ? 'Høy' : rec.priority === 'medium' ? 'Middels' : 'Lav'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Timing: {rec.timing}</span>
                    <span className="font-semibold text-indigo-600">Påvirkning: {formatNOK(rec.expected_impact)}</span>
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