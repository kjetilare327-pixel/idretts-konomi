import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Link2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { formatNOK } from '../shared/FormatUtils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function AIPaymentMatcher({ teamId, bankTransactions, claims, players }) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState(null);
  const [applying, setApplying] = useState({});
  const queryClient = useQueryClient();

  const unmatchedBank = bankTransactions.filter(bt => !bt.reconciled && bt.amount > 0);
  const openClaims = claims.filter(c => c.status === 'pending' || c.status === 'overdue');

  const runMatching = async () => {
    setLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Du er regnskapssystem for et norsk idrettslag. Match disse innkommende bankbetalinger mot åpne krav.

Innkommende bankbetalinger (umatchede, positive beløp):
${JSON.stringify(unmatchedBank.slice(0, 30).map(bt => ({
  id: bt.id, date: bt.transaction_date, amount: bt.amount,
  description: bt.description, reference: bt.reference
})), null, 2)}

Åpne krav:
${JSON.stringify(openClaims.slice(0, 50).map(c => {
  const p = players.find(pl => pl.id === c.player_id);
  return { id: c.id, playerId: c.player_id, playerName: p?.full_name, amount: c.amount, type: c.type, dueDate: c.due_date, kidRef: c.kid_reference };
}), null, 2)}

For hver banktransaksjon: finn det best matchende kravet basert på beløp, referanse, KID og dato.
Angi konfidensgrad 0-1 (1=perfekt match).
Svar på norsk.`,
        response_json_schema: {
          type: 'object',
          properties: {
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  bankTransactionId: { type: 'string' },
                  bankDescription: { type: 'string' },
                  bankAmount: { type: 'number' },
                  bankDate: { type: 'string' },
                  claimId: { type: 'string' },
                  playerName: { type: 'string' },
                  claimAmount: { type: 'number' },
                  confidence: { type: 'number' },
                  matchReason: { type: 'string' },
                  amountDifference: { type: 'number' },
                }
              }
            },
            unmatchedTransactions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  bankTransactionId: { type: 'string' },
                  bankDescription: { type: 'string' },
                  bankAmount: { type: 'number' },
                  suggestion: { type: 'string' },
                }
              }
            }
          }
        }
      });
      setMatches(res);
    } catch (e) {
      toast.error('Feil: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const applyMatch = async (match) => {
    setApplying(p => ({ ...p, [match.bankTransactionId]: true }));
    try {
      await Promise.all([
        base44.entities.BankTransaction.update(match.bankTransactionId, {
          reconciled: true,
          matched_claim_id: match.claimId,
        }),
        base44.entities.Claim.update(match.claimId, { status: 'paid' }),
      ]);
      toast.success(`Matchet: ${match.bankDescription} → ${match.playerName}`);
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      setMatches(prev => ({ ...prev, matches: prev.matches.filter(m => m.bankTransactionId !== match.bankTransactionId) }));
    } catch (e) {
      toast.error('Feil: ' + e.message);
    } finally {
      setApplying(p => ({ ...p, [match.bankTransactionId]: false }));
    }
  };

  const confidenceColor = (c) => c >= 0.8 ? 'text-emerald-600' : c >= 0.5 ? 'text-amber-600' : 'text-red-600';
  const confidenceBadge = (c) => c >= 0.8 ? 'bg-emerald-100 text-emerald-700' : c >= 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Link2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>AI Betalingsmatching</CardTitle>
              <CardDescription>
                AI matcher innbetalinger mot åpne fakturaer automatisk
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{unmatchedBank.length} umatchede innbetalinger</span>
            <Button onClick={runMatching} disabled={loading || unmatchedBank.length === 0} className="gap-2 bg-blue-600 hover:bg-blue-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Matcher...' : 'Kjør AI-matching'}
            </Button>
          </div>
        </div>
      </CardHeader>

      {loading && (
        <CardContent className="py-10 flex flex-col items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600 mb-3" />
          <p className="text-slate-500 text-sm">Analyserer betalinger og matcher mot åpne krav...</p>
        </CardContent>
      )}

      {unmatchedBank.length === 0 && !matches && (
        <CardContent>
          <div className="py-6 text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm">Ingen umatchede innbetalinger</p>
          </div>
        </CardContent>
      )}

      {matches && (
        <CardContent className="space-y-4">
          {/* Suggested matches */}
          {matches.matches?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Foreslåtte matcher ({matches.matches.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {matches.matches.map((m, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-medium text-slate-500">Bank:</span>
                          <span className="text-sm font-semibold">{formatNOK(m.bankAmount)}</span>
                          <span className="text-xs text-slate-500 truncate">{m.bankDescription}</span>
                          <span className="text-xs text-slate-400">{m.bankDate}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-medium text-slate-500">Krav:</span>
                          <span className="text-sm">{m.playerName}</span>
                          <span className="text-xs text-slate-500">{formatNOK(m.claimAmount)}</span>
                          {m.amountDifference !== 0 && (
                            <Badge variant="outline" className="text-xs text-amber-600">
                              avvik {formatNOK(Math.abs(m.amountDifference))}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${confidenceBadge(m.confidence)}`}>
                            {Math.round(m.confidence * 100)}% sikker
                          </Badge>
                          <span className="text-xs text-slate-500">{m.matchReason}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" className="gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                          disabled={applying[m.bankTransactionId]}
                          onClick={() => applyMatch(m)}>
                          {applying[m.bankTransactionId] ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Godkjenn
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched */}
          {matches.unmatchedTransactions?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Umatchede transaksjoner ({matches.unmatchedTransactions.length})
              </h3>
              <div className="space-y-1">
                {matches.unmatchedTransactions.map((t, i) => (
                  <div key={i} className="p-2 rounded border bg-amber-50 dark:bg-amber-950/20 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{formatNOK(t.bankAmount)}</span>
                      <span className="text-xs text-slate-500 truncate ml-2">{t.bankDescription}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{t.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={runMatching} className="gap-2">
            <Sparkles className="w-4 h-4" /> Kjør matching på nytt
          </Button>
        </CardContent>
      )}
    </Card>
  );
}