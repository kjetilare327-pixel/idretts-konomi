// v5-restored – original working onboarding
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, ArrowRight, Loader2 } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { toast } from 'sonner';

const SPORTS = ['Fotball', 'Håndball', 'Ski', 'Svømming', 'Friidrett', 'Basketball', 'Volleyball', 'Ishockey', 'Tennis', 'Annet'];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', sport_type: '', estimated_members: '', nif_number: '' });
  const [gdpr, setGdpr] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!form.name || !form.sport_type) { toast.error('Fyll inn lagsnavn og idrettstype.'); return; }
    if (!gdpr) { toast.error('Du må samtykke til GDPR-vilkårene.'); return; }
    if (saving) return;

    setSaving(true);
    toast.loading('Oppretter lag…', { id: 'ct' });

    try {
      const trialEnd = format(addDays(new Date(), 14), 'yyyy-MM-dd');
      let user;
      try {
        user = await base44.auth.me();
      } catch (authErr) {
        console.error('[Onboarding] auth.me failed – redirecting to login', authErr);
        toast.error('Sesjonen er utløpt – logg inn igjen.', { id: 'ct' });
        setSaving(false);
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      if (!user) {
        toast.error('Sesjonen er utløpt – logg inn igjen.', { id: 'ct' });
        setSaving(false);
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      if (user?.role !== 'admin') {
        await base44.auth.updateMe({ role: 'admin' });
        user = await base44.auth.me();
      }

      const newTeam = await base44.entities.Team.create({
        ...form,
        estimated_members: Number(form.estimated_members) || 0,
        subscription_status: 'trial',
        trial_end_date: trialEnd,
        gdpr_consent: true,
        members: [{ email: user.email, role: 'admin' }],
      });

      toast.success('Lag opprettet!', { id: 'ct' });
      localStorage.setItem('idrettsøkonomi_team_id', newTeam.id);
      navigate(createPageUrl('Dashboard'));
    } catch (err) {
      console.error('[Onboarding] Team creation failed', err);
      const msg = err?.response?.data?.message || err?.message || 'Ukjent feil';
      toast.error('Feil: ' + msg, { id: 'ct' });
      setSaving(false);
    }
  };

  const btnStyle = (active) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', height: 48, fontSize: '1rem', fontWeight: 600,
    border: 'none', borderRadius: 8, cursor: active ? 'pointer' : 'not-allowed',
    backgroundColor: active ? '#059669' : '#d1fae5',
    color: active ? '#fff' : '#6b7280',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#ecfdf5,#f8fafc)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Shield style={{ width: 32, height: 32, color: '#fff' }} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>IdrettsØkonomi</h1>
          <p style={{ color: '#64748b', marginTop: 8 }}>Enkel økonomistyring for idrettslag</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: 32 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 4 }}>
            {step === 1 ? 'Opprett ditt lag' : 'GDPR-samtykke'}
          </h2>
          <p style={{ color: '#64748b', marginBottom: 24, fontSize: '0.875rem' }}>
            {step === 1 ? 'Fyll inn informasjon om idrettslaget' : 'Vi trenger ditt samtykke for å behandle data'}
          </p>

          {step === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <Label htmlFor="team-name">Lagsnavn *</Label>
                <Input id="team-name" placeholder="F.eks. Lillestrøm FK" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ marginTop: 6 }} />
              </div>
              <div>
                <Label htmlFor="sport-type">Idrettstype *</Label>
                <div style={{ marginTop: 6 }}>
                  <Select value={form.sport_type} onValueChange={v => setForm(f => ({ ...f, sport_type: v }))}>
                    <SelectTrigger id="sport-type"><SelectValue placeholder="Velg idrett" /></SelectTrigger>
                    <SelectContent>
                      {SPORTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="members">Estimert antall medlemmer</Label>
                <Input id="members" type="number" placeholder="25" value={form.estimated_members}
                  onChange={e => setForm(f => ({ ...f, estimated_members: e.target.value }))} style={{ marginTop: 6 }} />
              </div>
              <div>
                <Label htmlFor="nif">NIF-nummer (valgfritt)</Label>
                <Input id="nif" placeholder="Valgfritt" value={form.nif_number}
                  onChange={e => setForm(f => ({ ...f, nif_number: e.target.value }))} style={{ marginTop: 6 }} />
              </div>
              <button
                type="button"
                onClick={() => { if (form.name && form.sport_type) setStep(2); }}
                style={btnStyle(form.name && form.sport_type)}
              >
                Neste <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ padding: 16, background: '#f8fafc', borderRadius: 12, fontSize: '0.875rem', lineHeight: 1.6 }}>
                <p><strong>Personvern og databehandling</strong></p>
                <p style={{ marginTop: 8 }}>Vi lagrer kun nødvendig informasjon for å drifte økonomistyringen for ditt lag.</p>
                <p style={{ marginTop: 8 }}>Du kan når som helst be om å slette all data via innstillinger.</p>
                <p style={{ marginTop: 8 }}>Vi deler aldri data med tredjeparter utover betalingsbehandling via Stripe.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <input type="checkbox" id="gdpr" checked={gdpr} onChange={e => setGdpr(e.target.checked)}
                  style={{ marginTop: 3, width: 18, height: 18, accentColor: '#059669', cursor: 'pointer', flexShrink: 0 }} />
                <label htmlFor="gdpr" style={{ fontSize: '0.875rem', lineHeight: 1.6, cursor: 'pointer' }}>
                  Jeg samtykker til behandling av data som beskrevet over, og bekrefter at jeg har myndighet til å opprette dette laget.
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={saving}
                  style={{ flex: 1, height: 48, fontSize: '1rem', fontWeight: 500, background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}
                >
                  Tilbake
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving}
                  style={{ flex: 1, height: 48, fontSize: '1rem', fontWeight: 600, background: saving ? '#6ee7b7' : '#059669', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {saving && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                  Opprett lag
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', textAlign: 'center', color: '#94a3b8' }}>
                14 dagers gratis prøveperiode – ingen kortinfo nødvendig
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}