import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Send, Users, Target, Activity, Plus } from 'lucide-react';
import { toast } from 'sonner';

const ACTIVITY_TYPES = [
  { key: 'events', label: 'Arrangementer', color: 'bg-blue-100 text-blue-700' },
  { key: 'volunteer', label: 'Frivillig arbeid', color: 'bg-green-100 text-green-700' },
  { key: 'payment', label: 'Betalinger', color: 'bg-amber-100 text-amber-700' },
];

export default function AIPredictiveSegmentation({ teamId, players, claims, transactions }) {
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState(null);
  const [campaignDialog, setCampaignDialog] = useState({ open: false, segment: null });
  const [campaignForm, setCampaignForm] = useState({ subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const runPrediction = async () => {
    setLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyser disse lagsmedlemmene og forutsi hvem som mest sannsynlig vil engasjere seg i ulike aktiviteter.

Spillere: ${JSON.stringify(players.map(p => ({
  id: p.id, name: p.full_name, email: p.user_email, role: p.role,
  balance: p.balance, paymentStatus: p.payment_status,
  claimsCount: claims.filter(c => c.player_id === p.id).length,
  paidClaims: claims.filter(c => c.player_id === p.id && c.status === 'paid').length,
})))}

Generer:
1. Foreslåtte nye segmenter basert på mønstre du observerer
2. For hvert segment: hvem som sannsynligvis vil engasjere seg i arrangementer, frivillig arbeid og betalinger
3. Anbefalte kampanjer for hvert segment

Svar på norsk.`,
        response_json_schema: {
          type: 'object',
          properties: {
            segments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  rationale: { type: 'string' },
                  memberEmails: { type: 'array', items: { type: 'string' } },
                  engagementPredictions: {
                    type: 'object',
                    properties: {
                      events: { type: 'number' },
                      volunteer: { type: 'number' },
                      payment: { type: 'number' },
                    }
                  },
                  recommendedCampaign: {
                    type: 'object',
                    properties: {
                      subject: { type: 'string' },
                      message: { type: 'string' },
                    }
                  }
                }
              }
            },
            overallInsight: { type: 'string' }
          }
        }
      });
      setPredictions(res);
    } catch (e) {
      toast.error('Feil ved analyse: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const openCampaign = (segment) => {
    setCampaignForm({
      subject: segment.recommendedCampaign?.subject || '',
      message: segment.recommendedCampaign?.message || '',
    });
    setCampaignDialog({ open: true, segment });
  };

  const sendCampaign = async () => {
    const { segment } = campaignDialog;
    if (!segment || !campaignForm.subject || !campaignForm.message) return;
    setSending(true);
    try {
      const memberEmails = segment.memberEmails || [];
      const matchedPlayers = players.filter(p => memberEmails.includes(p.user_email));

      await Promise.all(matchedPlayers.map(p =>
        base44.integrations.Core.SendEmail({
          to: p.user_email,
          subject: campaignForm.subject,
          body: `<p>Hei ${p.full_name},</p><p>${campaignForm.message.replace(/\n/g, '</p><p>')}</p>`,
        })
      ));
      toast.success(`Kampanje sendt til ${matchedPlayers.length} mottakere!`);
      setCampaignDialog({ open: false, segment: null });
    } catch (e) {
      toast.error('Feil ved sending: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const saveSegment = async (seg) => {
    try {
      await base44.entities.MemberSegment.create({
        team_id: teamId,
        name: seg.name,
        description: seg.description,
        criteria: { role: 'all' },
        member_count: seg.memberEmails?.length || 0,
      });
      toast.success(`Segment "${seg.name}" lagret!`);
    } catch (e) {
      toast.error('Feil: ' + e.message);
    }
  };

  if (!predictions && !loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Prediktiv AI-segmentering</CardTitle>
                <CardDescription>AI foreslår segmenter og predikerer engasjement</CardDescription>
              </div>
            </div>
            <Button onClick={runPrediction} className="gap-2 bg-purple-600 hover:bg-purple-700">
              <Sparkles className="w-4 h-4" /> Kjør prediktiv analyse
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-3" />
          <p className="text-slate-500">Analyserer mønstre og predikerer engasjement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {predictions?.overallInsight && (
          <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900">
            <p className="text-sm text-purple-800 dark:text-purple-300">
              <span className="font-semibold">AI-innsikt:</span> {predictions.overallInsight}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {predictions?.segments?.map((seg, i) => (
            <Card key={i} className="border border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-600" />
                    <CardTitle className="text-base">{seg.name}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    <Users className="w-3 h-3 mr-1" /> {seg.memberEmails?.length || 0}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500">{seg.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Engasjementsprediksjoner
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ACTIVITY_TYPES.map(a => (
                      <span key={a.key} className={`text-xs px-2 py-1 rounded-full font-medium ${a.color}`}>
                        {a.label}: {Math.round((seg.engagementPredictions?.[a.key] || 0) * 100)}%
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-500 italic">{seg.rationale}</p>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="gap-1 text-xs flex-1" onClick={() => saveSegment(seg)}>
                    <Plus className="w-3 h-3" /> Lagre segment
                  </Button>
                  <Button size="sm" className="gap-1 text-xs flex-1 bg-purple-600 hover:bg-purple-700" onClick={() => openCampaign(seg)}>
                    <Send className="w-3 h-3" /> Send kampanje
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={runPrediction} className="gap-2">
          <Sparkles className="w-4 h-4" /> Kjør analyse på nytt
        </Button>
      </div>

      <Dialog open={campaignDialog.open} onOpenChange={o => setCampaignDialog({ open: o, segment: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-purple-600" />
              Kampanje til: {campaignDialog.segment?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-500">
              Mottakere: {campaignDialog.segment?.memberEmails?.length || 0} medlemmer
            </p>
            <div className="space-y-1">
              <Label>Emne</Label>
              <Input value={campaignForm.subject} onChange={e => setCampaignForm(p => ({ ...p, subject: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Melding</Label>
              <Textarea rows={5} value={campaignForm.message} onChange={e => setCampaignForm(p => ({ ...p, message: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCampaignDialog({ open: false, segment: null })}>Avbryt</Button>
              <Button onClick={sendCampaign} disabled={sending} className="gap-2 bg-purple-600 hover:bg-purple-700">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}