import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, AlertTriangle, TrendingUp, Info, RefreshCw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const INSIGHT_ICONS = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  opportunity: TrendingUp,
  info: Info
};

const INSIGHT_COLORS = {
  critical: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900',
  warning: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900',
  opportunity: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-900',
  info: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900'
};

export default function AiHint({ teamId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (teamId) {
      loadAnalysis();
    }
  }, [teamId]);

  const loadAnalysis = async () => {
    if (!teamId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await base44.functions.invoke('analyzeFinancials', { team_id: teamId });
      setAnalysis(response.data.analysis);
    } catch (err) {
      setError(err.message || 'Kunne ikke laste AI-analyse');
      console.error('AI analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (index) => {
    setExpanded(prev => ({ ...prev, [index]: !prev[index] }));
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <CardTitle className="text-base">AI-analyse</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            <span className="ml-3 text-sm text-slate-500">Analyserer økonomi...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <CardTitle className="text-base">AI-analyse</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={loadAnalysis}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
            <AlertDescription className="text-red-800 dark:text-red-200 text-sm">
              {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!analysis || !analysis.insights || analysis.insights.length === 0) {
    return (
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <CardTitle className="text-base">AI-analyse</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={loadAnalysis}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Ingen innsikt tilgjengelig ennå.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <CardTitle className="text-base">AI-analyse & anbefalinger</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={loadAnalysis} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {analysis.summary && (
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
            <p className="text-sm text-slate-700 dark:text-slate-300">{analysis.summary}</p>
          </div>
        )}

        {analysis.insights.map((insight, index) => {
          const Icon = INSIGHT_ICONS[insight.type] || Info;
          const colorClass = INSIGHT_COLORS[insight.type] || INSIGHT_COLORS.info;
          const isExpanded = expanded[index];

          return (
            <div key={index} className={`border rounded-lg overflow-hidden ${colorClass}`}>
              <button
                onClick={() => toggleExpanded(index)}
                className="w-full p-3 flex items-start gap-3 hover:opacity-80 transition-opacity"
              >
                <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm">{insight.title}</h4>
                    {isExpanded ? <ChevronUp className="w-4 h-4 mt-0.5" /> : <ChevronDown className="w-4 h-4 mt-0.5" />}
                  </div>
                  {!isExpanded && (
                    <p className="text-xs mt-1 opacity-80 line-clamp-2">{insight.description}</p>
                  )}
                </div>
              </button>
              
              {isExpanded && (
                <div className="px-3 pb-3 pt-0 pl-11">
                  <p className="text-sm mb-2">{insight.description}</p>
                  {insight.action && (
                    <div className="mt-2 p-2 rounded bg-white/50 dark:bg-black/20">
                      <p className="text-xs font-semibold mb-1">💡 Anbefalt handling:</p>
                      <p className="text-xs">{insight.action}</p>
                    </div>
                  )}
                  {insight.savings_potential && insight.savings_potential > 0 && (
                    <Badge variant="outline" className="mt-2">
                      Potensial besparelse: {insight.savings_potential.toLocaleString('nb-NO')} kr
                    </Badge>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}