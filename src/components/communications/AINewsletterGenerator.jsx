import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Newspaper, Copy, Send, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';

const TONES = [
  { value: 'friendly', label: 'Vennlig og uformell' },
  { value: 'professional', label: 'Profesjonell' },
  { value: 'motivating', label: 'Motiverende' },
  { value: 'informative', label: 'Informativ' },
];

export default function AINewsletterGenerator({ teamName, transactions, players, claims, onUseContent }) {
  const [loading, setLoading] = useState(false);
  const [tone, setTone] = useState('friendly');
  const [customContext, setCustomContext] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const thisMonth = new Date().toLocaleString('nb-NO', { month: 'long', year: 'numeric' });
      const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const overdueCount = claims.filter(c => c.status === 'overdue').length;
      const paidCount = claims.filter(c => c.status === 'paid').length;
      const activeMembers = players.filter(p => p.status === 'active').length;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Du er kommunikasjonsansvarlig for idrettslaget "${teamName}". Lag et nyhetsbrev for ${thisMonth}.

Tone: ${tone}
Lagets data:
- Aktive medlemmer: ${activeMembers}
- Inntekter siste periode: ${totalIncome} kr
- Utgifter siste periode: ${totalExpense} kr  
- Nettoresultat: ${totalIncome - totalExpense} kr
- Betalte krav: ${paidCount}, Forfalte krav: ${overdueCount}

${customContext ? `Tilleggsinfo fra kasserer: ${customContext}` : ''}

Generer:
1. Et engasjerende nyhetsbrev (HTML-formatert, ca 300-400 ord) med:
   - Vennlig åpning og intro
   - Finansiell status (positiv vinkling)
   - Relevante påminnelser (betaling, arrangement, etc.) uten å navngi enkeltpersoner
   - Motiverende avslutning
2. En e-post emne-linje (fengende, maks 60 tegn)
3. En kort SMS-versjon (maks 160 tegn)
4. 3 nøkkel-takeaways som kulepunkter

Svar på norsk. Personalisering med {{name}} der det passer.`,
        response_json_schema: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            htmlBody: { type: 'string' },
            smsVersion: { type: 'string' },
            keyTakeaways: { type: 'array', items: { type: 'string' } },
            targetAudience: { type: 'string' },
            suggestedSendTime: { type: 'string' },
          }
        }
      });
      setResult(res);
    } catch (e) {
      toast.error('Feil: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Kopiert!');
  };

  const useAsEmail = () => {
    if (onUseContent && result) {
      onUseContent({ subject: result.subject, body: result.htmlBody.replace(/<[^>]+>/g, '') });
    }
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Newspaper className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <CardTitle>AI Nyhetsbrevgenerator</CardTitle>
            <CardDescription>Generer personlige nyhetsbrev basert på lagets hendelser og økonomi</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tilleggsinfo (valgfritt)</Label>
            <Input
              placeholder="F.eks. vi vant cupen, ny trener, kommende arrangement..."
              value={customContext}
              onChange={e => setCustomContext(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        <Button onClick={generate} disabled={loading} className="w-full gap-2 bg-purple-600 hover:bg-purple-700">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Genererer nyhetsbrev...' : 'Generer nyhetsbrev med AI'}
        </Button>

        {loading && (
          <div className="py-4 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600 mb-2" />
            <p className="text-sm">Lager personlig nyhetsbrev for {teamName}...</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Subject + metadata */}
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Emne</p>
                  <p className="font-semibold text-sm">{result.subject}</p>
                </div>
                <button onClick={() => copyToClipboard(result.subject)} className="p-1.5 rounded hover:bg-purple-100">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                {result.targetAudience && <span>👥 {result.targetAudience}</span>}
                {result.suggestedSendTime && <span>🕐 {result.suggestedSendTime}</span>}
              </div>
            </div>

            {/* Key takeaways */}
            {result.keyTakeaways?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nøkkelpunkter</p>
                {result.keyTakeaways.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-purple-500 font-bold flex-shrink-0">•</span>
                    <span className="text-slate-600 dark:text-slate-400">{t}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Email preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">E-post innhold</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => copyToClipboard(result.htmlBody.replace(/<[^>]+>/g, ''))}>
                    <Copy className="w-3 h-3" /> Kopier
                  </Button>
                  {onUseContent && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-purple-300 text-purple-700" onClick={useAsEmail}>
                      <Send className="w-3 h-3" /> Bruk i melding
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                value={result.htmlBody.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')}
                readOnly
                className="min-h-48 text-sm font-mono resize-none bg-slate-50 dark:bg-slate-800"
              />
            </div>

            {/* SMS version */}
            {result.smsVersion && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SMS-versjon</p>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => copyToClipboard(result.smsVersion)}>
                    <Copy className="w-3 h-3" /> Kopier
                  </Button>
                </div>
                <div className="p-3 rounded bg-slate-100 dark:bg-slate-800 text-sm">{result.smsVersion}</div>
                <p className="text-xs text-slate-400">{result.smsVersion.length}/160 tegn</p>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={generate} className="gap-2 w-full">
              <RefreshCw className="w-4 h-4" /> Generer på nytt
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}