import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, AlertTriangle, CheckCircle2, XCircle, FileText, Trash2, Archive } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function GdprCompliancePanel({ teamId }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const analyzeCompliance = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await base44.functions.invoke('analyzeGdprCompliance', { team_id: teamId });
      setAnalysis(response.data);
    } catch (err) {
      setError(err.message || 'Kunne ikke analysere GDPR-overholdelse');
      console.error('GDPR analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
    if (!analysis) return;
    
    const report = `GDPR COMPLIANCE RAPPORT
Generert: ${new Date().toLocaleDateString('nb-NO')}

COMPLIANCE SCORE: ${analysis.analysis.compliance_score}/100
RISIKONIVÅ: ${analysis.analysis.risk_level.toUpperCase()}

SAMMENDRAG:
${analysis.analysis.compliance_summary}

DATAØVERSIKT:
- Totalt spillere: ${analysis.data_overview.total_players}
- Aktive spillere: ${analysis.data_overview.active_players}
- Arkiverte spillere: ${analysis.data_overview.archived_players}
- Revisjonslogger: ${analysis.data_overview.total_audit_logs}
- Gamle revisjonslogger (>3 år): ${analysis.data_overview.old_audit_logs}

IDENTIFISERTE PROBLEMER:
${analysis.analysis.issues.map((issue, i) => `
${i + 1}. ${issue.category} [${issue.severity.toUpperCase()}]
   ${issue.description}
   Påvirkede poster: ${issue.affected_records}
   Juridisk referanse: ${issue.legal_reference}
   Anbefaling: ${issue.recommendation}
`).join('\n')}

FORESLÅTTE TILTAK:
${analysis.analysis.suggested_actions.map((action, i) => `
${i + 1}. ${action.action_type.toUpperCase()} - ${action.target}
   ${action.description}
   Prioritet: ${action.priority.toUpperCase()}
   Påvirkede poster: ${action.estimated_records}
   Frist: ${action.deadline}
`).join('\n')}

ANONYMISERINGSSTRATEGIER:
${analysis.analysis.anonymization_strategies.map((strat, i) => `
${i + 1}. ${strat.data_type}
   Nåværende: ${strat.current_state}
   Foreslått: ${strat.proposed_anonymization}
   Påvirkning: ${strat.impact}
`).join('\n')}

NESTE GJENNOMGANG: ${analysis.analysis.next_review_date}
`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gdpr-compliance-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardContent className="p-12 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
          <p className="text-lg font-medium">Analyserer GDPR-overholdelse...</p>
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
          <Button onClick={analyzeCompliance} className="mt-4 gap-2">
            <Shield className="w-4 h-4" />
            Prøv på nytt
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="border-0 shadow-md dark:bg-slate-900 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-500" />
            <CardTitle>GDPR Compliance Analyse</CardTitle>
          </div>
          <CardDescription>
            Analyser personopplysninger og få anbefalinger for GDPR-overholdelse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={analyzeCompliance} size="lg" className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Shield className="w-5 h-5" />
            Start GDPR-analyse
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = analysis.analysis;

  return (
    <div className="space-y-6">
      {/* Compliance Score */}
      <Card className={`border-0 shadow-md dark:bg-slate-900 ${
        data.risk_level === 'low' ? 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20' :
        data.risk_level === 'medium' ? 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20' :
        'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20'
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className={`w-6 h-6 ${
                data.risk_level === 'low' ? 'text-emerald-500' :
                data.risk_level === 'medium' ? 'text-amber-500' :
                'text-red-500'
              }`} />
              <CardTitle>GDPR Compliance Status</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={analyzeCompliance} size="sm">
                Oppdater
              </Button>
              <Button onClick={generateReport} size="sm" className="gap-2">
                <FileText className="w-4 h-4" />
                Last ned rapport
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 mb-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">Compliance Score</p>
              <p className="text-4xl font-bold">{data.compliance_score}/100</p>
            </div>
            <div>
              <Badge className={
                data.risk_level === 'low' ? 'bg-emerald-100 text-emerald-700' :
                data.risk_level === 'medium' ? 'bg-amber-100 text-amber-700' :
                data.risk_level === 'high' ? 'bg-red-100 text-red-700' :
                'bg-red-200 text-red-900'
              }>
                Risiko: {data.risk_level === 'low' ? 'Lav' : data.risk_level === 'medium' ? 'Middels' : data.risk_level === 'high' ? 'Høy' : 'Kritisk'}
              </Badge>
            </div>
          </div>
          <p className="text-sm leading-relaxed">{data.compliance_summary}</p>
          <p className="text-xs text-slate-500 mt-2">Neste gjennomgang: {data.next_review_date}</p>
        </CardContent>
      </Card>

      {/* Issues */}
      {data.issues && data.issues.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Identifiserte problemer ({data.issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.issues.map((issue, idx) => (
                <div key={idx} className={`p-4 rounded-lg border ${
                  issue.severity === 'critical' ? 'border-red-200 bg-red-50 dark:bg-red-950/30' :
                  issue.severity === 'high' ? 'border-orange-200 bg-orange-50 dark:bg-orange-950/30' :
                  issue.severity === 'medium' ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/30' :
                  'border-blue-200 bg-blue-50 dark:bg-blue-950/30'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{issue.category}</h3>
                    <Badge className={
                      issue.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      issue.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                      issue.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }>
                      {issue.severity === 'critical' ? 'Kritisk' : issue.severity === 'high' ? 'Høy' : issue.severity === 'medium' ? 'Middels' : 'Lav'}
                    </Badge>
                  </div>
                  <p className="text-sm mb-2">{issue.description}</p>
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p>Påvirkede poster: {issue.affected_records}</p>
                    <p>Juridisk: {issue.legal_reference}</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100 mt-2">→ {issue.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggested Actions */}
      {data.suggested_actions && data.suggested_actions.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base">Foreslåtte tiltak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.suggested_actions.map((action, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {action.action_type === 'delete' && <Trash2 className="w-5 h-5 text-red-500" />}
                      {action.action_type === 'anonymize' && <Shield className="w-5 h-5 text-blue-500" />}
                      {action.action_type === 'archive' && <Archive className="w-5 h-5 text-amber-500" />}
                      {action.action_type === 'review' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                      {action.action_type === 'update_policy' && <FileText className="w-5 h-5 text-purple-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{action.target}</h3>
                        <Badge variant="outline" className="text-xs">
                          {action.action_type === 'delete' ? 'Slett' :
                           action.action_type === 'anonymize' ? 'Anonymiser' :
                           action.action_type === 'archive' ? 'Arkiver' :
                           action.action_type === 'review' ? 'Gjennomgå' : 'Oppdater policy'}
                        </Badge>
                        <Badge className={
                          action.priority === 'critical' ? 'bg-red-100 text-red-700' :
                          action.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          action.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }>
                          {action.priority === 'critical' ? 'Kritisk' : action.priority === 'high' ? 'Høy' : action.priority === 'medium' ? 'Middels' : 'Lav'}
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{action.description}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Påvirkede poster: {action.estimated_records}</span>
                        <span>Frist: {action.deadline}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anonymization Strategies */}
      {data.anonymization_strategies && data.anonymization_strategies.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base">Anonymiseringsstrategier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.anonymization_strategies.map((strat, idx) => (
                <div key={idx} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
                  <h3 className="font-semibold mb-2">{strat.data_type}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Nåværende</p>
                      <p className="font-mono text-xs bg-white dark:bg-slate-900 p-2 rounded">{strat.current_state}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Foreslått anonymisering</p>
                      <p className="font-mono text-xs bg-white dark:bg-slate-900 p-2 rounded">{strat.proposed_anonymization}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Påvirkning: {strat.impact}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}