/**
 * VippsClaimActions – shown inside the player detail modal (admin view)
 * Lets admin generate/copy Vipps payment links per claim,
 * and manually confirm payment if needed.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNOK } from '@/components/shared/FormatUtils';
import { ExternalLink, Copy, CheckCircle2, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const CLAIM_TYPE_LABELS = {
  kontingent: 'Kontingent', cup: 'Cup', dugnad: 'Dugnad', utstyr: 'Utstyr', annet: 'Annet',
};

export default function VippsClaimActions({ claims = [], teamId }) {
  const [loading, setLoading] = useState(null); // claim id being processed
  const [confirming, setConfirming] = useState(null);
  const queryClient = useQueryClient();

  const unpaid = claims.filter(c => c.status !== 'paid' && c.status !== 'cancelled');

  const handleGenerate = async (claim) => {
    setLoading(claim.id);
    try {
      const res = await base44.functions.invoke('createVippsPayment', { claim_id: claim.id });
      const data = res.data;
      if (data.success) {
        toast.success('Vipps-lenke opprettet og sendt til spiller');
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['ledger'] });
      } else {
        toast.error(data.error || 'Kunne ikke opprette lenke');
      }
    } catch (e) {
      toast.error('Feil: ' + e.message);
    } finally {
      setLoading(null);
    }
  };

  const handleConfirm = async (claim) => {
    setConfirming(claim.id);
    try {
      const res = await base44.functions.invoke('vippsCallback', {
        order_id: claim.kid_reference || claim.id,
        status: 'completed',
      });
      const data = res.data;
      if (data.success) {
        toast.success('Betaling bekreftet!');
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['ledger'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      } else {
        toast.error(data.error || 'Bekreftelse feilet');
      }
    } catch (e) {
      toast.error('Feil: ' + e.message);
    } finally {
      setConfirming(null);
    }
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    toast.success('Lenke kopiert!');
  };

  if (unpaid.length === 0) {
    return <p className="text-sm text-slate-400 italic">Ingen ubetalte krav.</p>;
  }

  return (
    <div className="space-y-2">
      {unpaid.map(claim => (
        <div key={claim.id} className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-sm">{CLAIM_TYPE_LABELS[claim.type] || claim.type}</span>
              {claim.description && <span className="text-xs text-slate-400 ml-2">– {claim.description}</span>}
              {claim.status === 'overdue' && (
                <Badge className="ml-2 text-xs bg-red-100 text-red-700">Forfalt</Badge>
              )}
            </div>
            <span className="font-bold text-red-600">{formatNOK(claim.amount)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {claim.vipps_payment_link ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => window.open(claim.vipps_payment_link, '_blank')}
                >
                  <ExternalLink className="w-3 h-3" /> Åpne lenke
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => copyLink(claim.vipps_payment_link)}
                >
                  <Copy className="w-3 h-3" /> Kopier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-7 text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={() => handleGenerate(claim)}
                  disabled={loading === claim.id}
                >
                  {loading === claim.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Ny lenke
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-7 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleConfirm(claim)}
                  disabled={confirming === claim.id}
                >
                  {confirming === claim.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Bekreft betalt
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 text-xs h-7 bg-orange-600 hover:bg-orange-700"
                onClick={() => handleGenerate(claim)}
                disabled={loading === claim.id}
              >
                {loading === claim.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                Generer Vipps-lenke
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}