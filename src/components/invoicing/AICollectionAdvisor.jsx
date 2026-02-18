import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, ShieldAlert, Mail, Phone, Archive, TrendingDown, CheckCircle2 } from 'lucide-react';
import { formatNOK } from '../shared/FormatUtils';
import { toast } from 'sonner';

const ACTION_ICONS = {
  email: Mail,
  phone: Phone,
  escalate: ShieldAlert,
  writeoff: Archive,
  reminder: Mail,
};

export default function AICollectionAdvisor({ teamId, players, claims }) {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState(null);
  const [sendingIdx, setSendingIdx] = useState(null);

  const analyze = async () => {
    setLoading(true);
    try {
      const overdueClaims = claims.filter(c => c.status === 'overdue' || (c.status === 'pending' && new Date(c.due_date) < new Date()));
      const grouped = {};
      overdueClaims.forEach(c => {
        if (!grouped[c.player_id]) grouped[c.player_id] = [];
        grouped[c.player_id].push(c);
      });

      const memberData = Object.entries(grouped).map(([pid, cls]) => {
        const player = players.find(p => p.id === pid);
        const totalOverdue = cls.reduce((s, c) => s + c.amount, 0);
        const oldestDue = cls.reduce((oldest, c) => c.due_date < oldest ? c.due_date : oldest, cls[0].due_date);
        const daysPastDue = Math.floor((new Date() - new Date(oldestDue)) / 86400000);
        return { name: player?.full_name || 'Ukjent', email: player?.user_email, playerId: pid, totalOverdue, claimsCount: cls.length, daysPastDue, paymentHistory: player?.payment_status };
      });

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Du er inkassorådgiver for et norsk idrettslag. Analyser disse overdue-kravsituasjonene og gi konkrete anbefalinger for inkassoprosessen.

Overdue krav per medlem:
${JSON.stringify(memberData, null, 2)}

Basert på antall dager forfalt, beløp, og historikk - gi spesifikke handlinger for hvert tilfelle.
Prioriter etter alvorlighetsgrad.
For høyrisikomedlemmer: foreslå konkret e-posttekst.
Vurder om noen bør avskrives vs. eskaleres.
Svar på norsk.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overview: { type: 'string' },
            totalAtRisk: { type: 'number' },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  playerName: { type: 'string' },
                  playerId: { type: 'string' },
                  totalOverdue: { type: 'number' },
                  daysPastDue: { type: 'number' },
                  riskLevel: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                  recommendedAction: { type: 'string', enum: ['email', 'phone', 'escalate', 'writeoff', 'reminder'] },
                  actionDescription: { type: 'string' },
                  emailTemplate: { type: 'string' },
                  expectedRecoveryRate: { type: 'number' },
                }
              }
            },
            strategyTips: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      setAdvice(res);
    } catch (e) {
      toast.error('Feil: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (rec, idx) => {
    if (!rec.emailTemplate) return;
    setSendingIdx(idx);
    try {
      const player = players.find(p => p.id === rec.playerId);
      if (!player?.user_email) { toast.error('Fant ikke e-post'); return; }
      await base44.integrations.Core.SendEmail({
        to: player.user_email,
        subject: `Purring – forfalt betaling til idrettslaget`,
        body: `<p>${rec.emailTemplate.replace(/\n/g, '</p><p>')}</p>`,
      });
      toast.success(`Purring sendt til ${player.full_name}`);
    } catch (e) {
      toast.error('Feil: ' + e.message);
    } finally {
      setSendingIdx(null);
    }
  };

  const riskConfig = {
    critical: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Kritisk' },
    high: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Høy' },
    medium: { color: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Middels' },
    low: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Lav' },
  };

  const overdueTotal = claims.filter(c => c.status === 'overdue' || (c.status === 'pending' && new Date(c.due_date) < new Date())).reduce((s, c) => s + c.amount, 0);

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <CardTitle>AI Inkassorådgiver</CardTitle>
              <CardDescription>AI-anbefalinger for oppfølging av forfalte krav</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {overdueTotal > 0 && (
              <span className="text-sm font-semibold text-red-600">{formatNOK(overdueTotal)} forfalt</span>
            )}
            <Button onClick={analyze} disabled={loading} className="gap-2 bg-red-600 hover:bg-red-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Analyserer...' : 'Analyser'}
            </Button>
          </div>
        </div>
      </CardHeader>

      {loading && (
        <CardContent className="py-10 flex flex-col items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-red-600 mb-3" />
          <p className="text-slate-500 text-sm">Analyserer inkassosituasjon...</p>
        </CardContent>
      )}

      {advice && (
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">{advice.overview}</div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {advice.recommendations?.map((rec, i) => {
              const risk = riskConfig[rec.riskLevel] || riskConfig.medium;
              const ActionIcon = ACTION_ICONS[rec.recommendedAction] || Mail;
              return (
                <div key={i} className={`p-4 rounded-lg border ${risk.color}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{rec.playerName}</span>
                        <Badge className={`text-xs border ${risk.color}`}>{risk.label} risiko</Badge>
                      </div>
                      <div className="flex gap-3 text-xs text-slate-600 mt-1">
                        <span>{formatNOK(rec.totalOverdue)} forfalt</span>
                        <span>{rec.daysPastDue} dager over forfall</span>
                        {rec.expectedRecoveryRate !== undefined && (
                          <span>Innkrevingsrate: {Math.round(rec.expectedRecoveryRate * 100)}%</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <ActionIcon className="w-3 h-3" />
                        {rec.recommendedAction}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mb-2">{rec.actionDescription}</p>
                  {rec.emailTemplate && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={sendingIdx === i}
                      onClick={() => sendReminder(rec, i)}>
                      {sendingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                      Send purring
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {advice.strategyTips?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Strategiske råd</p>
              {advice.strategyTips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">{tip}</span>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={analyze} className="gap-2">
            <Sparkles className="w-4 h-4" /> Oppdater analyse
          </Button>
        </CardContent>
      )}
    </Card>
  );
}