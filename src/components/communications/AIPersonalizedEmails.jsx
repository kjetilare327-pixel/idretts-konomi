import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Sparkles, Mail, Send, CheckCircle2, User } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';
import { toast } from 'sonner';

export default function AIPersonalizedEmails({ teamId, teamName, players, claims }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [sending, setSending] = useState(false);
  const [drafts, setDrafts] = useState(null);
  const [selected, setSelected] = useState({});

  const generateDrafts = async () => {
    setAnalyzing(true);
    try {
      const membersData = players.slice(0, 30).map(p => {
        const memberClaims = claims.filter(c => c.player_id === p.id);
        const overdue = memberClaims.filter(c => c.status === 'overdue');
        const pending = memberClaims.filter(c => c.status === 'pending');
        return {
          id: p.id,
          name: p.full_name,
          email: p.user_email,
          role: p.role,
          paymentStatus: p.payment_status,
          overdueAmount: overdue.reduce((s, c) => s + c.amount, 0),
          pendingAmount: pending.reduce((s, c) => s + c.amount, 0),
          overdueCount: overdue.length,
          lastActivity: p.updated_date,
        };
      }).filter(m => m.email);

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Du er lagleder i "${teamName}". Lag personlige e-postutkast til disse medlemmene basert på deres aktivitet og betalingsstatus.

Lag kun e-poster til de som trenger kontakt (betalingsproblemer, høy gjeld, eller de du vil engasjere).
Unngå å sende e-post til de som har god status uten grunn.

Medlemsdata:
${JSON.stringify(membersData, null, 1)}

For hvert relevant medlem, lag et e-postutkast med:
- Personlig hilsen
- Relevant innhold basert på status
- Vennlig og motiverende tone
- Klar handlingsoppfordring

Kategorier: payment_reminder (forfalt), payment_followup (ubetalt), engagement (inaktiv), welcome (ny), recognition (god betaler).
Svar på norsk.`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            emailDrafts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  memberId: { type: 'string' },
                  memberName: { type: 'string' },
                  memberEmail: { type: 'string' },
                  category: { type: 'string', enum: ['payment_reminder', 'payment_followup', 'engagement', 'welcome', 'recognition'] },
                  subject: { type: 'string' },
                  body: { type: 'string' },
                  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  reason: { type: 'string' },
                }
              }
            }
          }
        }
      });
      setDrafts(res);
      const sel = {};
      res.emailDrafts?.filter(d => d.priority === 'high').forEach((_, i) => { sel[i] = true; });
      setSelected(sel);
    } catch (e) {
      toast.error('Feil: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const sendSelected = async () => {
    const toSend = drafts.emailDrafts.filter((_, i) => selected[i]);
    if (toSend.length === 0) return;
    setSending(true);
    let ok = 0, fail = 0;
    for (const draft of toSend) {
      try {
        await base44.integrations.Core.SendEmail({
          to: draft.memberEmail,
          subject: draft.subject,
          body: `<p>${draft.body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
        });
        await base44.entities.SentMessage.create({
          team_id: teamId,
          recipient_email: draft.memberEmail,
          recipient_name: draft.memberName,
          subject: draft.subject,
          body: draft.body,
          status: 'sent',
          sent_at: new Date().toISOString(),
          segment: draft.category,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setSending(false);
    toast.success(`${ok} e-poster sendt${fail > 0 ? `, ${fail} feilet` : ''}`);
    setDrafts(prev => ({ ...prev, emailDrafts: prev.emailDrafts.filter((_, i) => !selected[i]) }));
    setSelected({});
  };

  const categoryConfig = {
    payment_reminder: { label: 'Betalingspurring', color: 'bg-red-100 text-red-700' },
    payment_followup: { label: 'Betalingsoppfølging', color: 'bg-amber-100 text-amber-700' },
    engagement: { label: 'Engasjement', color: 'bg-blue-100 text-blue-700' },
    welcome: { label: 'Velkomst', color: 'bg-emerald-100 text-emerald-700' },
    recognition: { label: 'Anerkjennelse', color: 'bg-purple-100 text-purple-700' },
  };

  const priorityConfig = {
    high: 'bg-red-50 border-red-200',
    medium: 'bg-amber-50 border-amber-200',
    low: 'bg-slate-50 border-slate-200',
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <Mail className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <CardTitle>AI Personlige E-poster</CardTitle>
              <CardDescription>AI analyserer hvert medlem og skriver skreddersydde e-poster automatisk</CardDescription>
            </div>
          </div>
          <Button onClick={generateDrafts} disabled={analyzing} className="gap-2 bg-teal-600 hover:bg-teal-700">
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analyzing ? 'Analyserer...' : 'Generer utkast'}
          </Button>
        </div>
      </CardHeader>

      {analyzing && (
        <CardContent className="py-10 flex flex-col items-center">
          <Loader2 className="w-7 h-7 animate-spin text-teal-600 mb-3" />
          <p className="text-slate-500 text-sm">Analyserer {players.length} medlemmer og skriver personlige e-poster...</p>
        </CardContent>
      )}

      {drafts && (
        <CardContent className="space-y-4">
          {drafts.summary && (
            <p className="text-sm text-slate-600 dark:text-slate-400 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">{drafts.summary}</p>
          )}

          {drafts.emailDrafts?.length > 0 ? (
            <>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {drafts.emailDrafts.map((d, i) => {
                  const catCfg = categoryConfig[d.category] || { label: d.category, color: 'bg-slate-100 text-slate-700' };
                  return (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors dark:bg-slate-800/50 ${selected[i] ? 'ring-2 ring-teal-400' : ''} ${priorityConfig[d.priority] || ''}`}>
                      <Checkbox
                        checked={!!selected[i]}
                        onCheckedChange={v => setSelected(p => ({ ...p, [i]: v }))}
                        className="mt-1 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="font-medium text-sm">{d.memberName}</span>
                          <span className="text-xs text-slate-400">{d.memberEmail}</span>
                          <Badge className={`text-xs ${catCfg.color} ml-auto`}>{catCfg.label}</Badge>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">Emne: {d.subject}</p>
                        <p className="text-xs text-slate-500 line-clamp-2">{d.body}</p>
                        <p className="text-xs text-slate-400 mt-1 italic">Begrunnelse: {d.reason}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => {
                    const all = {};
                    drafts.emailDrafts.forEach((_, i) => { all[i] = true; });
                    setSelected(all);
                  }}>Velg alle</Button>
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setSelected({})}>Fravelg</Button>
                </div>
                <Button onClick={sendSelected} disabled={sending || selectedCount === 0} className="gap-2 bg-teal-600 hover:bg-teal-700">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send {selectedCount} e-post{selectedCount !== 1 ? 'er' : ''}
                </Button>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm">Ingen e-poster nødvendig nå – alle medlemmer er i god stand</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}