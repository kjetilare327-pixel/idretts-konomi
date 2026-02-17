import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle, Calendar, Loader2 } from 'lucide-react';
import { formatNOK } from '../shared/FormatUtils';

export default function CashFlowPredictor({ teamId }) {
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);

  const predictCashFlow = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('predictCashFlow', { 
        team_id: teamId,
        months_ahead: 3 
      });
      setPrediction(response.data);
    } catch (error) {
      alert('Feil ved prediksjon: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Prediktiv kontantstrømanalyse
            </CardTitle>
            <CardDescription>AI-basert prognose for kommende måneder</CardDescription>
          </div>
          <Button onClick={predictCashFlow} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Kjør prediksjon
          </Button>
        </div>
      </CardHeader>

      {prediction && (
        <CardContent className="space-y-6">
          {/* Alerts */}
          {prediction.alerts?.length > 0 && (
            <div className="space-y-2">
              {prediction.alerts.map((alert, idx) => (
                <div key={idx} className={`p-3 rounded-lg border-l-4 ${
                  alert.severity === 'high' ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' :
                  'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20'
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                      alert.severity === 'high' ? 'text-red-600' : 'text-amber-600'
                    }`} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{alert.month}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{alert.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chart */}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={prediction.predictions}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatNOK(value)} />
              <Legend />
              <Line type="monotone" dataKey="predicted_income" stroke="#10b981" name="Forventet inntekt" strokeWidth={2} />
              <Line type="monotone" dataKey="predicted_expense" stroke="#ef4444" name="Forventet utgift" strokeWidth={2} />
              <Line type="monotone" dataKey="net_prediction" stroke="#3b82f6" name="Netto" strokeWidth={2} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>

          {/* Monthly details */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Månedlige detaljer</h4>
            {prediction.predictions.map((month, idx) => (
              <Card key={idx} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{month.month}</h4>
                      <Badge className={
                        month.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                        month.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }>
                        {month.confidence === 'high' ? 'Høy sikkerhet' :
                         month.confidence === 'medium' ? 'Middels sikkerhet' : 'Lav sikkerhet'}
                      </Badge>
                    </div>
                    <div className={`text-right ${month.net_prediction >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      <p className="text-lg font-bold">{formatNOK(month.net_prediction)}</p>
                      <p className="text-xs">Netto resultat</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Inntekt</p>
                      <p className="font-medium text-emerald-600">{formatNOK(month.predicted_income)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Utgift</p>
                      <p className="font-medium text-red-600">{formatNOK(month.predicted_expense)}</p>
                    </div>
                  </div>

                  {month.factors && (
                    <div className="mt-3 pt-3 border-t text-xs text-slate-500">
                      <p>Faktorer: {month.factors.unpaid_claims} ubetalte krav ({formatNOK(month.factors.expected_claim_income)}), {month.factors.scheduled_events} arrangementer (~{formatNOK(month.factors.estimated_event_costs)})</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary */}
          <Card className="border-2 border-blue-200 dark:border-blue-900">
            <CardContent className="p-4">
              <h4 className="font-semibold mb-3">Samlet prognose ({prediction.predictions.length} måneder)</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Total inntekt</p>
                  <p className="text-lg font-bold text-emerald-600">{formatNOK(prediction.summary.total_predicted_income)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Total utgift</p>
                  <p className="text-lg font-bold text-red-600">{formatNOK(prediction.summary.total_predicted_expense)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Netto posisjon</p>
                  <p className={`text-lg font-bold ${prediction.summary.net_position >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatNOK(prediction.summary.net_position)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      )}
    </Card>
  );
}