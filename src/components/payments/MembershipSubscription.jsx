import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { CreditCard, Loader2, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

const PLANS = [
  {
    id: 'monthly',
    label: 'Månedlig',
    price_id: 'price_1T2Hf9Q9oCmhj7daq7c0RlyK',
    amount: 250,
    interval: 'per måned',
    badge: null,
  },
  {
    id: 'yearly',
    label: 'Årlig',
    price_id: 'price_1T2Hf9Q9oCmhj7daxmHfyvyU',
    amount: 2500,
    interval: 'per år',
    badge: 'Spar 17%',
  },
];

export default function MembershipSubscription({ team }) {
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const plan = PLANS.find(p => p.id === selectedPlan);

  const handleSubscribe = async () => {
    if (!plan) return;

    // Block if running inside iframe (preview)
    if (window.self !== window.top) {
      alert('Betaling fungerer kun fra den publiserte appen, ikke i forhåndsvisning.');
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('stripeCheckout', {
        mode: 'subscription',
        price_id: plan.price_id,
        team_id: team.id,
        team_name: team.name,
        success_url: window.location.href + '?membership=success',
        cancel_url: window.location.href,
      });

      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (err) {
      console.error(err);
      setMessage('Noe gikk galt. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  // Success redirect
  const params = new URLSearchParams(window.location.search);
  const membershipSuccess = params.get('membership') === 'success';

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-emerald-500" />
          Medlemskontingent – automatisk fornyelse
        </CardTitle>
        <p className="text-xs text-slate-500">Betal kontingent med kort – fornyes automatisk via Stripe</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {membershipSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Abonnement aktivert! Kontingenten fornyes automatisk.
          </div>
        )}

        {/* Plan selector */}
        <div className="grid grid-cols-2 gap-3">
          {PLANS.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPlan(p.id)}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                selectedPlan === p.id
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-200'
              }`}
            >
              {p.badge && (
                <span className="absolute -top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                  {p.badge}
                </span>
              )}
              <p className="font-semibold text-sm">{p.label}</p>
              <p className="text-xl font-bold mt-1">{formatNOK(p.amount)}</p>
              <p className="text-xs text-slate-500">{p.interval}</p>
              {selectedPlan === p.id && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute top-3 right-3" />
              )}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Plan</span>
            <span className="font-medium">{plan?.label} kontingent</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Beløp</span>
            <span className="font-medium">{plan && formatNOK(plan.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Fornyelse</span>
            <span className="font-medium">{plan?.id === 'monthly' ? 'Automatisk månedlig' : 'Automatisk årlig'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Kansellering</span>
            <span className="font-medium text-slate-400">Når som helst</span>
          </div>
        </div>

        {message && <p className="text-xs text-red-500">{message}</p>}

        <Button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          {loading ? 'Sender til betaling...' : 'Aktiver abonnement'}
          {!loading && <ExternalLink className="w-3.5 h-3.5" />}
        </Button>

        <p className="text-xs text-center text-slate-400 flex items-center justify-center gap-1">
          <CreditCard className="w-3 h-3" /> Sikret av Stripe – kanseller når du vil
        </p>
      </CardContent>
    </Card>
  );
}