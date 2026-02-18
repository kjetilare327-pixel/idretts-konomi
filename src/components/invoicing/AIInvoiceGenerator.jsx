import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Sparkles, FileText, CheckCircle2, AlertCircle, Users } from 'lucide-react';
import { formatNOK } from '../shared/FormatUtils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function AIInvoiceGenerator({ teamId, players, claims }) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [selected, setSelected] = useState({});
  const queryClient = useQueryClient();

  const analyze = async () => {
    setLoading(true);
    try {
      const openClaims = claims.filter(c => c.status !== 'paid' && c.status !== 'cancelled');
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Du er kasserer i et norsk idrettslag. Analyser disse spillerne og åpne krav, og foreslå hvilke nye fakturaer/krav som bør opprettes.

Spillere (${players.length} aktive):
${players.slice(0, 50).map(p => `- ${p.full_name} (${p.role}), saldo: ${p.balance || 0} kr, status: ${p.payment_status}`).join('\n')}

Åpne krav (${openClaims.length}):
${openClaims.slice(0, 30).map(c => `- Spiller ${c.player_id}: ${c.type}, ${c.amount} kr, forfall: ${c.due_date}, status: ${c.status}`).join('\n')}

Foreslå fakturaer som bør opprettes basert på:
1. Spillere uten åpne krav (kan trenge kontingent)
2. Forfalt gjeld som bør purres/eskaleres
3. Sesongrelaterte krav som vanligvis sendes på denne tiden av året

Svar på norsk. Bruk playerId fra spillerlisten.`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            invoiceSuggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  playerId: { type: 'string' },
                  playerName: { type: 'string' },
                  type: { type: 'string', enum: ['kontingent', 'cup', 'dugnad', 'utstyr', 'annet'] },
                  amount: { type: 'number' },
                  description: { type: 'string' },
                  dueDays: { type: 'number' },
                  reason: { type: 'string' },
                  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                }
              }
            }
          }
        }
      });
      setSuggestions(res);
      const sel = {};
      res.invoiceSuggestions?.forEach((_, i) => { sel[i] = true; });
      setSelected(sel);
    } catch (e) {
      toast.error('Feil: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const createSelected = async () => {
    const toCreate = suggestions.invoiceSuggestions.filter((_, i) => selected[i]);
    if (toCreate.length === 0) return;
    setCreating(true);
    try {
      const today = new Date();
      await Promise.all(toCreate.map(s => {
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + (s.dueDays || 14));
        const player = players.find(p => p.id === s.playerId || p.full_name === s.playerName);
        if (!player) return Promise.resolve();
        return base44.entities.Claim.create({
          team_id: teamId,
          player_id: player.id,
          type: s.type,
          amount: s.amount,
          description: s.description,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'pending',
        });
      }));
      toast.success(`${toCreate.length} fakturaer opprettet!`);
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      setSuggestions(null);
    } catch (e) {
      toast.error('Feil: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  const priorityColor = (p) => p === 'high' ? 'bg-red-100 text-red-700' : p === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle>AI Fakturaforslag</CardTitle>
              <CardDescription>AI analyserer medlemsdata og foreslår fakturaer som bør opprettes</CardDescription>
            </div>
          </div>
          <Button onClick={analyze} disabled={loading} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analyserer...' : 'Analyser og foreslå'}
          </Button>
        </div>
      </CardHeader>

      {loading && (
        <CardContent className="py-10 flex flex-col items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mb-3" />
          <p className="text-slate-500 text-sm">Analyserer medlemsdata og åpne krav...</p>
        </CardContent>
      )}

      {suggestions && (
        <CardContent className="space-y-4">
          {suggestions.summary && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400">
              {suggestions.summary}
            </div>
          )}

          {suggestions.invoiceSuggestions?.length > 0 ? (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {suggestions.invoiceSuggestions.map((s, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${selected[i] ? 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-200' : 'bg-slate-50 dark:bg-slate-800 border-transparent'}`}>
                    <Checkbox
                      checked={!!selected[i]}
                      onCheckedChange={v => setSelected(p => ({ ...p, [i]: v }))}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{s.playerName}</span>
                        <Badge variant="outline" className="text-xs">{s.type}</Badge>
                        <Badge className={`text-xs ${priorityColor(s.priority)}`}>
                          {s.priority === 'high' ? 'Høy' : s.priority === 'medium' ? 'Middels' : 'Lav'}
                        </Badge>
                        <span className="text-sm font-semibold text-emerald-600 ml-auto">{formatNOK(s.amount)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Begrunnelse: {s.reason} • Forfall: {s.dueDays || 14} dager</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    const all = {};
                    suggestions.invoiceSuggestions.forEach((_, i) => { all[i] = true; });
                    setSelected(all);
                  }}>Velg alle</Button>
                  <Button size="sm" variant="outline" onClick={() => setSelected({})}>Fravelg alle</Button>
                </div>
                <Button onClick={createSelected} disabled={creating || selectedCount === 0} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Opprett {selectedCount} faktura{selectedCount !== 1 ? 'er' : ''}
                </Button>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm">Ingen fakturaer å opprette på nåværende tidspunkt</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}