import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { formatNOK } from '@/components/shared/FormatUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Link2, Loader2, AlertCircle, ChevronsRight } from 'lucide-react';

/**
 * Shows unmatched bank transactions + suggests claim matches.
 * Matching NEVER auto-confirms – user must click "Bekreft match".
 */
export default function ManualMatchPanel({ bankTransactions = [], claims = [], players = [], teamId }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(null); // { bankTx, claim }
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const playerMap = useMemo(() => {
    const m = {};
    players.forEach(p => { m[p.id] = p; });
    return m;
  }, [players]);

  // Only unmatched bank credits (incoming money)
  const unmatched = useMemo(() =>
    bankTransactions.filter(bt => !bt.reconciled && bt.amount > 0),
    [bankTransactions]
  );

  // For each unmatched bank tx, suggest top-3 claims by amount proximity
  const withSuggestions = useMemo(() => {
    const openClaims = claims.filter(c => c.status !== 'paid' && c.status !== 'cancelled');
    return unmatched.map(bt => {
      const suggestions = openClaims
        .map(c => ({
          ...c,
          score: Math.abs(bt.amount - c.amount),
          player: playerMap[c.player_id],
        }))
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);
      return { bt, suggestions };
    });
  }, [unmatched, claims, playerMap]);

  const matchMutation = useMutation({
    mutationFn: async ({ bankTx, claim, noteText }) => {
      await base44.entities.BankTransaction.update(bankTx.id, { reconciled: true, matched_claim_id: claim.id });
      await base44.entities.Claim.update(claim.id, { status: 'paid' });
      await base44.entities.Payment.create({
        team_id: teamId,
        player_id: claim.player_id,
        claim_id: claim.id,
        amount: bankTx.amount,
        payment_method: 'bank_transfer',
        status: 'completed',
        paid_at: new Date(bankTx.transaction_date).toISOString(),
        notes: noteText || `Matchet mot banktransaksjon: ${bankTx.description}`,
      });
    },
    onMutate: async ({ bankTx, claim }) => {
      await qc.cancelQueries({ queryKey: ['bankTransactions', teamId] });
      await qc.cancelQueries({ queryKey: ['claims', teamId] });
      const prevBankTx = qc.getQueryData(['bankTransactions', teamId]);
      const prevClaims = qc.getQueryData(['claims', teamId]);
      qc.setQueryData(['bankTransactions', teamId], old =>
        old ? old.map(bt => bt.id === bankTx.id ? { ...bt, reconciled: true } : bt) : old
      );
      qc.setQueryData(['claims', teamId], old =>
        old ? old.map(c => c.id === claim.id ? { ...c, status: 'paid' } : c) : old
      );
      return { prevBankTx, prevClaims };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevBankTx) qc.setQueryData(['bankTransactions', teamId], ctx.prevBankTx);
      if (ctx?.prevClaims) qc.setQueryData(['claims', teamId], ctx.prevClaims);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['bankTransactions', teamId] });
      qc.invalidateQueries({ queryKey: ['claims', teamId] });
      qc.invalidateQueries({ queryKey: ['payments', teamId] });
    },
  });

  const handleConfirm = async () => {
    if (!confirming) return;
    setSaving(true);
    await matchMutation.mutateAsync({ bankTx: confirming.bankTx, claim: confirming.claim, noteText: note });
    setSaving(false);
    setConfirming(null);
    setNote('');
  };

  if (unmatched.length === 0) {
    return (
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Alle innbetalinger er matchet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Umatchede innbetalinger ({unmatched.length})
          </CardTitle>
          <CardDescription>
            Velg krav å matche mot. Ingen endringer lagres uten din bekreftelse.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {withSuggestions.map(({ bt, suggestions }) => (
            <div key={bt.id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Bank tx header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <p className="text-sm font-medium">{bt.description}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(bt.transaction_date).toLocaleDateString('nb-NO')}
                    {bt.reference ? ` · KID: ${bt.reference}` : ''}
                  </p>
                </div>
                <span className="text-base font-bold text-emerald-600">+{formatNOK(bt.amount)}</span>
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Spiller</TableHead>
                      <TableHead>Type krav</TableHead>
                      <TableHead className="text-right">Krav</TableHead>
                      <TableHead className="text-right">Differanse</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestions.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{c.player?.full_name || '–'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">{c.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatNOK(c.amount)}</TableCell>
                        <TableCell className={`text-right text-xs ${c.score === 0 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                          {c.score === 0 ? '✓ Eksakt' : `±${formatNOK(c.score)}`}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={c.score === 0 ? 'default' : 'outline'}
                            className={`gap-1 ${c.score === 0 ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                            onClick={() => { setConfirming({ bankTx: bt, claim: c }); setNote(''); }}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            Match
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-4 py-3 text-sm text-slate-400">Ingen åpne krav å foreslå</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <Dialog open={!!confirming} onOpenChange={() => setConfirming(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bekreft match</DialogTitle>
          </DialogHeader>
          {confirming && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Innbetaling:</span>
                  <span className="font-semibold text-emerald-600">+{formatNOK(confirming.bankTx.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Spiller:</span>
                  <span className="font-medium">{confirming.claim.player?.full_name || '–'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Krav:</span>
                  <span>{confirming.claim.type} – {formatNOK(confirming.claim.amount)}</span>
                </div>
                {Math.abs(confirming.bankTx.amount - confirming.claim.amount) > 0 && (
                  <div className="flex justify-between text-amber-600 font-medium">
                    <span>Differanse:</span>
                    <span>±{formatNOK(Math.abs(confirming.bankTx.amount - confirming.claim.amount))}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notat (valgfritt)</Label>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="F.eks. delinnbetaling, kontant, etc."
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConfirming(null)}>Avbryt</Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
                  onClick={handleConfirm}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Bekreft – marker som betalt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}