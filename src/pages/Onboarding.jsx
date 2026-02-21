import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useTeam } from '@/components/shared/TeamContext';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { toast } from 'sonner';

const SPORTS = ['Fotball', 'Håndball', 'Ski', 'Svømming', 'Friidrett', 'Basketball', 'Volleyball', 'Ishockey', 'Tennis', 'Annet'];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', sport_type: '', estimated_members: '', nif_number: '' });
  const [gdpr, setGdpr] = useState(false);
  const [saving, setSaving] = useState(false);
  const { loadData } = useTeam();
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!form.name || !form.sport_type || !gdpr) return;
    setSaving(true);
    try {
      const trialEnd = format(addDays(new Date(), 14), 'yyyy-MM-dd');
      const user = await base44.auth.me();

      // Create team immediately — no Stripe blocking this
      await base44.entities.Team.create({
        ...form,
        estimated_members: Number(form.estimated_members) || 0,
        subscription_status: 'trial',
        trial_end_date: trialEnd,
        gdpr_consent: true,
        members: [{ email: user.email, role: 'admin' }],
      });

      // loadData can hang — give it a 5s timeout, then navigate regardless
      await Promise.race([
        loadData(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('loadData timeout')), 5000)),
      ]).catch(err => {
        console.warn('loadData skipped or timed out:', err.message);
      });

      navigate(createPageUrl('Dashboard'));
    } catch (err) {
      console.error('Team creation failed:', err);
      toast.error('Kunne ikke opprette laget: ' + (err?.message || 'Ukjent feil'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">IdrettsØkonomi</h1>
          <p className="text-slate-500 mt-2">Enkel økonomistyring for idrettslag</p>
        </div>

        <Card className="shadow-xl border-0 dark:bg-slate-900">
          <CardHeader>
            <CardTitle>{step === 1 ? 'Opprett ditt lag' : 'GDPR-samtykke'}</CardTitle>
            <CardDescription>
              {step === 1 ? 'Fyll inn informasjon om idrettslaget' : 'Vi trenger ditt samtykke for å behandle data'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 1 ? (
              <>
                <div className="space-y-2">
                  <Label>Lagsnavn *</Label>
                  <Input placeholder="F.eks. Lillestrøm FK" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Idrettstype *</Label>
                  <Select value={form.sport_type} onValueChange={v => setForm({ ...form, sport_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Velg idrett" /></SelectTrigger>
                    <SelectContent>
                      {SPORTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estimert antall medlemmer</Label>
                  <Input type="number" placeholder="25" value={form.estimated_members} onChange={e => setForm({ ...form, estimated_members: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>NIF-nummer (valgfritt)</Label>
                  <Input placeholder="Valgfritt" value={form.nif_number} onChange={e => setForm({ ...form, nif_number: e.target.value })} />
                </div>
                <Button onClick={() => { if (form.name && form.sport_type) setStep(2); }} disabled={!form.name || !form.sport_type} className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base">
                  Neste <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            ) : (
              <>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm leading-relaxed space-y-3">
                  <p><strong>Personvern og databehandling</strong></p>
                  <p>Vi lagrer kun nødvendig informasjon for å drifte økonomistyringen for ditt lag. Data inkluderer lagnavn, transaksjoner og budsjettinformasjon.</p>
                  <p>Du kan når som helst be om å slette all data knyttet til laget via innstillinger.</p>
                  <p>Vi deler aldri data med tredjeparter utover betalingsbehandling via Stripe.</p>
                </div>
                <div className="flex items-start gap-3 pt-2">
                  <Checkbox id="gdpr" checked={gdpr} onCheckedChange={setGdpr} className="mt-0.5" />
                  <Label htmlFor="gdpr" className="text-sm leading-relaxed cursor-pointer">
                    Jeg samtykker til behandling av data som beskrevet over, og bekrefter at jeg har myndighet til å opprette dette laget.
                  </Label>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Tilbake</Button>
                  <Button onClick={handleCreate} disabled={!gdpr || saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12 text-base">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Opprett lag
                  </Button>
                </div>
                <p className="text-xs text-center text-slate-500">14 dagers gratis prøveperiode – ingen kortinfo nødvendig</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}