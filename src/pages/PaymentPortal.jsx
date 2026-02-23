import React, { useState } from 'react';
import { useTeam } from '../components/shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, Clock, CheckCircle2, ExternalLink, Download, Loader2 } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';
import DonationWidget from '@/components/payments/DonationWidget';
import MembershipSubscription from '@/components/payments/MembershipSubscription';

export default function PaymentPortal() {
  const { currentTeam, playerProfile, user } = useTeam();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(null);

  const { data: claims = [] } = useQuery({
    queryKey: ['my-claims', currentTeam?.id, playerProfile?.id],
    queryFn: () => base44.entities.Claim.filter({ 
      team_id: currentTeam.id,
      player_id: playerProfile.id 
    }),
    enabled: !!currentTeam && !!playerProfile,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['my-payments', currentTeam?.id, playerProfile?.id],
    queryFn: () => base44.entities.Payment.filter({ 
      team_id: currentTeam.id,
      player_id: playerProfile.id 
    }),
    enabled: !!currentTeam && !!playerProfile,
  });

  const unpaidClaims = claims.filter(c => c.status !== 'paid' && c.status !== 'cancelled');
  const totalUnpaid = unpaidClaims.reduce((sum, c) => sum + c.amount, 0);

  const handleVippsPayment = async (claim) => {
    setProcessing(claim.id);
    try {
      // If claim already has a link, open it directly
      if (claim.vipps_payment_link) {
        window.open(claim.vipps_payment_link, '_blank');
        setProcessing(null);
        return;
      }
      // Otherwise generate a new one
      const response = await base44.functions.invoke('createVippsPayment', { claim_id: claim.id });
      if (response.data.success) {
        window.open(response.data.payment_link, '_blank');
        queryClient.invalidateQueries({ queryKey: ['my-claims'] });
      } else {
        alert(response.data.error || 'Kunne ikke opprette betalingslenke');
      }
    } catch (err) {
      console.error('Payment error:', err);
      alert('Kunne ikke opprette betaling');
    } finally {
      setProcessing(null);
    }
  };

  if (!currentTeam || !playerProfile) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>
            Du må være registrert som spiller/forelder for å se dine betalinger.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Mine betalinger</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Oversikt over dine krav og betalingshistorikk
        </p>
      </div>

      {/* Stripe payments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MembershipSubscription team={currentTeam} />
        <DonationWidget team={currentTeam} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Totalt å betale</p>
                <p className="text-2xl font-bold text-red-600">{formatNOK(totalUnpaid)}</p>
              </div>
              <CreditCard className="w-8 h-8 text-red-400 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Ubetalte krav</p>
                <p className="text-2xl font-bold">{unpaidClaims.length}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Betalinger i år</p>
                <p className="text-2xl font-bold">{payments.filter(p => p.status === 'completed').length}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-400 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unpaid claims */}
      {unpaidClaims.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle>Ubetalte krav</CardTitle>
            <CardDescription>
              Betal direkte med Vipps eller bankoverføring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unpaidClaims.map(claim => (
                <div key={claim.id} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{claim.type}</h3>
                        {claim.status === 'overdue' && (
                          <Badge className="bg-red-100 text-red-700">Forfalt</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {claim.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Forfaller: {new Date(claim.due_date).toLocaleDateString('nb-NO')}</span>
                        {claim.kid_reference && <span>KID: {claim.kid_reference}</span>}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-2xl font-bold text-red-600 mb-3">
                        {formatNOK(claim.amount)}
                      </p>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => createVippsPayment(claim.id)}
                          disabled={processing === claim.id}
                          className="gap-2 bg-orange-600 hover:bg-orange-700"
                        >
                          {processing === claim.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Behandler...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-4 h-4" />
                              Betal med Vipps
                            </>
                          )}
                        </Button>
                        {claim.kid_reference && (
                          <div className="text-xs text-slate-500">
                            Eller: Bank {claim.kid_reference}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle>Betalingshistorikk</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length > 0 ? (
            <div className="space-y-3">
              {payments
                .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                .map(payment => (
                  <div key={payment.id} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{formatNOK(payment.amount)}</h3>
                          <Badge className={
                            payment.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            payment.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            payment.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-700'
                          }>
                            {payment.status === 'completed' ? 'Fullført' :
                             payment.status === 'pending' ? 'Venter' :
                             payment.status === 'failed' ? 'Feilet' : 'Refundert'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {payment.payment_method === 'vipps' ? 'Vipps' :
                             payment.payment_method === 'bank_transfer' ? 'Bank' :
                             payment.payment_method === 'card' ? 'Kort' : 'Kontant'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {payment.paid_at ? new Date(payment.paid_at).toLocaleString('nb-NO') : 
                           new Date(payment.created_date).toLocaleString('nb-NO')}
                        </p>
                        {payment.transaction_id && (
                          <p className="text-xs text-slate-400 mt-1">ID: {payment.transaction_id}</p>
                        )}
                      </div>
                      {payment.receipt_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(payment.receipt_url, '_blank')}
                          className="gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Kvittering
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-center py-8 text-slate-500">Ingen betalinger ennå</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}