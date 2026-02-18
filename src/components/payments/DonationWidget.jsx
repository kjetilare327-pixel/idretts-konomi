import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Heart, Loader2, CreditCard, ExternalLink } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

const PRESET_AMOUNTS = [100, 250, 500, 1000];

export default function DonationWidget({ team }) {
  const [amount, setAmount] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const finalAmount = selectedPreset || Number(amount);

  const handleDonate = async () => {
    if (!finalAmount || finalAmount < 10) return;

    // Block if running inside iframe (preview)
    if (window.self !== window.top) {
      alert('Betaling fungerer kun fra den publiserte appen, ikke i forhåndsvisning.');
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('stripeCheckout', {
        mode: 'donation',
        custom_amount: finalAmount,
        team_id: team.id,
        team_name: team.name,
        success_url: window.location.href + '?donation=success',
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

  // Show success message if redirected back
  const params = new URLSearchParams(window.location.search);
  const donationSuccess = params.get('donation') === 'success';

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          Støtt laget – gi en donasjon
        </CardTitle>
        <p className="text-xs text-slate-500">Trygg betaling med kort via Stripe</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {donationSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
            ✓ Takk for donasjonen! Den er registrert og vi setter stor pris på støtten.
          </div>
        )}

        {/* Preset amounts */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Velg beløp</p>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map(p => (
              <button
                key={p}
                onClick={() => { setSelectedPreset(p); setAmount(''); }}
                className={`py-2 px-3 rounded-lg text-sm font-semibold border transition-all ${
                  selectedPreset === p
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-red-300'
                }`}
              >
                {formatNOK(p)}
              </button>
            ))}
          </div>
        </div>

        {/* Custom amount */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Eller skriv inn eget beløp (NOK)</p>
          <Input
            type="number"
            min="10"
            placeholder="f.eks. 750"
            value={amount}
            onChange={e => { setAmount(e.target.value); setSelectedPreset(null); }}
          />
        </div>

        {finalAmount >= 10 && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-center">
            <p className="text-sm text-slate-500">Du donerer</p>
            <p className="text-2xl font-bold text-red-600">{formatNOK(finalAmount)}</p>
            <p className="text-xs text-slate-400">til {team.name}</p>
          </div>
        )}

        {message && <p className="text-xs text-red-500">{message}</p>}

        <Button
          onClick={handleDonate}
          disabled={loading || finalAmount < 10}
          className="w-full bg-red-500 hover:bg-red-600 gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          {loading ? 'Sender til betaling...' : `Doner ${finalAmount >= 10 ? formatNOK(finalAmount) : ''}`}
          {!loading && <ExternalLink className="w-3.5 h-3.5" />}
        </Button>

        <p className="text-xs text-center text-slate-400 flex items-center justify-center gap-1">
          <CreditCard className="w-3 h-3" /> Sikret av Stripe – vi lagrer ikke kortinfo
        </p>
      </CardContent>
    </Card>
  );
}