import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb, AlertTriangle, TrendingDown, Users, Target } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AIMemberSegmentation({ teamId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await base44.functions.invoke('analyzeMembers', { team_id: teamId });
      setAnalysis(response.data);
    } catch (err) {
      setError(err.message || 'Feil ved analyse');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high':
        return 'bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-800';
      case 'medium':
        return 'bg-amber-100 dark:bg-amber-950 border-amber-300 dark:border-amber-800';
      default:
        return 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800';
    }
  };

  const getRiskIcon = (level) => {
    if (level === 'high') return <AlertTriangle className="w-5 h-5 text-red-600" />;
    if (level === 'medium') return <TrendingDown className="w-5 h-5 text-amber-600" />;
    return null;
  };

  if (!analysis && !loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Lightbulb className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">AI-analyse av medlemmer</CardTitle>
                <CardDescription>
                  Få AI-foreslåtte segmenter og identifiser medlemmer i fare
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleAnalyze} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Lightbulb className="w-4 h-4" />
              Analyser medlemmer
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-slate-600 dark:text-slate-400">Analyserer medlemsdata...</p>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          {/* Key insights */}
          {analysis.insights && (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-900">
              <CardHeader>
                <CardTitle className="text-lg">Hovedfunn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Engasjement</p>
                  <p className="text-slate-600 dark:text-slate-400">{analysis.insights.engagement}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Betalingsmønstre</p>
                  <p className="text-slate-600 dark:text-slate-400">{analysis.insights.paymentTrends}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Frafallsrisiko</p>
                  <p className="text-slate-600 dark:text-slate-400">{analysis.insights.churnRisk}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Members at risk */}
          {analysis.atRiskMembers && analysis.atRiskMembers.length > 0 && (
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Medlemmer i risiko ({analysis.atRiskMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {analysis.atRiskMembers.map((member, i) => (
                    <div key={i} className={`p-4 rounded-lg border ${getRiskColor(member.riskLevel)}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          {getRiskIcon(member.riskLevel) && (
                            <div className="pt-1">
                              {getRiskIcon(member.riskLevel)}
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold">{member.name}</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{member.email}</p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            member.riskLevel === 'high'
                              ? 'destructive'
                              : member.riskLevel === 'medium'
                              ? 'secondary'
                              : 'default'
                          }
                        >
                          {member.riskLevel === 'high'
                            ? 'Høy risiko'
                            : member.riskLevel === 'medium'
                            ? 'Moderat risiko'
                            : 'Lav risiko'}
                        </Badge>
                      </div>

                      <div className="space-y-3 mt-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Risikofaktorer
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {member.riskFactors.map((factor, j) => (
                              <Badge key={j} variant="outline" className="text-xs">
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Foreslåtte tiltak
                          </p>
                          <ul className="text-sm space-y-1">
                            {member.suggestedActions.map((action, j) => (
                              <li key={j} className="flex gap-2">
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-700 dark:text-slate-300">{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dynamic segments */}
          {analysis.segments && analysis.segments.length > 0 && (
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  AI-foreslåtte segmenter ({analysis.segments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {analysis.segments.map((segment, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-white dark:bg-slate-900">
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-4 h-4 text-emerald-600" />
                          <h3 className="font-semibold">{segment.name}</h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {segment.description}
                        </p>
                      </div>

                      <div className="space-y-3 my-3 py-3 border-y">
                        <div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Karakteristika
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {segment.criteria}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Medlemmer ({segment.memberIds.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {segment.memberIds.slice(0, 3).map((id, j) => (
                              <Badge key={j} variant="secondary" className="text-xs">
                                {id.split('@')[0]}
                              </Badge>
                            ))}
                            {segment.memberIds.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{segment.memberIds.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                          Anbefalinger
                        </p>
                        <ul className="text-sm space-y-1">
                          {segment.recommendations.map((rec, j) => (
                            <li key={j} className="flex gap-2">
                              <span className="text-emerald-600">✓</span>
                              <span className="text-slate-700 dark:text-slate-300">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button onClick={handleAnalyze} variant="outline" className="gap-2">
              <Lightbulb className="w-4 h-4" />
              Kjør analyse på nytt
            </Button>
          </div>
        </>
      )}
    </div>
  );
}