import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, ArrowRight, Loader2, Users, Plus } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { toast } from 'sonner';
import TermsModal from '@/components/shared/TermsModal';

const SPORTS = ['Fotball', 'Håndball', 'Ski', 'Svømming', 'Friidrett', 'Basketball', 'Volleyball', 'Ishockey', 'Tennis', 'Annet'];

function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function Onboarding() {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [step, setStep] = useState(1);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        if (!u) { window.location.replace('/login'); return; }
        if (u?.tos_accepted) setTosAccepted(true);

        // If user already has teams, redirect to Dashboard
        const [created, memberships] = await Promise.all([
          base44.entities.Team.filter({ created_by: u.email }).catch(() => []),
          base44.entities.TeamMember.filter({ user_email: u.email.toLowerCase() }).catch(() => []),
        ]);
        if (created.length > 0 || memberships.length > 0) {
          window.location.replace('/Dashboard');
          return;
        }
      } catch (_) {}
      setCheckingUser(false);
    })();
  }, []);

  // Create team state
  const [form, setForm] = useState({ name: '', sport_type: '', estimated_members: '', nif_number: '' });
  const [gdpr, setGdpr] = useState(false);
  const [saving, setSaving] = useState(false);

  // Join team state
  const [joinCode, setJoinCode] = useState('');
  const [joinRole, setJoinRole] = useState('player');
  const [joining, setJoining] = useState(false);

  const handleCreate = async () => {
    if (!form.name || !form.sport_type) { toast.error('Fyll inn lagsnavn og idrettstype.'); return; }
    if (!gdpr) { toast.error('Du må samtykke til GDPR-vilkårene.'); return; }
    if (saving) return;

    setSaving(true);
    toast.loading('Oppretter lag…', { id: 'ct' });

    try {
      const trialEnd = format(addDays(new Date(), 14), 'yyyy-MM-dd');
      const user = await base44.auth.me();

      if (!user) {
        toast.error('Sesjonen er utløpt – logg inn igjen.', { id: 'ct' });
        setSaving(false);
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      const newTeam = await base44.entities.Team.create({
        ...form,
        estimated_members: Number(form.estimated_members) || 0,
        subscription_status: 'trial',
        trial_end_date: trialEnd,
        gdpr_consent: true,
        join_code: generateJoinCode(),
        members: [{ email: user.email, role: 'admin' }],
      });

      await base44.entities.TeamMember.create({
        team_id: newTeam.id,
        user_email: user.email.toLowerCase(),
        role: 'admin',
        status: 'active',
        invited_by_email: user.email,
      }).catch(e => console.warn('TeamMember create failed:', e));

      toast.success('Lag opprettet!', { id: 'ct' });
      localStorage.setItem('idrettsøkonomi_team_id', newTeam.id);
      window.location.replace('/Dashboard');
    } catch (err) {
      console.error('[Onboarding] Team creation failed', err);
      const msg = err?.response?.data?.message || err?.message || 'Ukjent feil';
      toast.error('Feil: ' + msg, { id: 'ct' });
      setSaving(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { toast.error('Skriv inn lagkoden.'); return; }
    if (joining) return;

    setJoining(true);
    toast.loading('Sjekker kode…', { id: 'jt' });

    try {
      const res = await base44.functions.invoke('joinTeamByCode', { join_code: joinCode.trim(), role: joinRole });
      const data = res.data;

      if (data.error) {
        toast.error(data.error, { id: 'jt' });
        setJoining(false);
        return;
      }

      toast.success(data.already_member ? `Du er allerede med i ${data.team_name}!` : `Du er nå med i ${data.team_name}!`, { id: 'jt' });
      localStorage.setItem('idrettsøkonomi_team_id', data.team_id);
      window.location.replace('/Dashboard');
    } catch (err) {
      console.error('[Onboarding] Join failed', err);
      toast.error('Feil: ' + (err?.response?.data?.error || err?.message || 'Ugyldig kode'), { id: 'jt' });
      setJoining(false);
    }
  };

  const btnStyle = (active) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', height: 48, fontSize: '1rem', fontWeight: 600,
    border: 'none', borderRadius: 8, cursor: active ? 'pointer' : 'not-allowed',
    backgroundColor: active ? '#059669' : '#d1fae5',
    color: active ? '#fff' : '#6b7280',
  });

  if (checkingUser) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#ecfdf5,#f8fafc)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {!tosAccepted && <TermsModal onAccepted={() => setTosAccepted(true)} />}
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Shield style={{ width: 32, height: 32, color: '#fff' }} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>IdrettsØkonomi</h1>
          <p style={{ color: '#64748b', marginTop: 8 }}>Enkel økonomistyring for idrettslag</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: 32 }}>

          {/* Mode selection */}
          {!mode && (
            <>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>Kom i gang</h2>
              <p style={{ color: '#64748b', marginBottom: 24, fontSize: '0.875rem' }}>Opprett et nytt lag eller bli med i et eksisterende.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  onClick={() => setMode('create')}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', border: '2px solid #e2e8f0', borderRadius: 12, background: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#059669'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Plus style={{ width: 22, height: 22, color: '#059669' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Opprett nytt lag</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 2 }}>Jeg er administrator og vil sette opp et lag</div>
                  </div>
                </button>

                <button
                  onClick={() => setMode('join')}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', border: '2px solid #e2e8f0', borderRadius: 12, background: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#059669'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users style={{ width: 22, height: 22, color: '#059669' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Bli med i lag</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 2 }}>Jeg har en lagkode fra min administrator</div>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Join with code */}
          {mode === 'join' && (
            <>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 4 }}>Bli med i lag</h2>
              <p style={{ color: '#64748b', marginBottom: 24, fontSize: '0.875rem' }}>Skriv inn koden du har fått fra administrator</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <Label htmlFor="join-code">Lagkode</Label>
                  <Input
                    id="join-code"
                    placeholder="F.eks. AB1234"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    style={{ marginTop: 6, fontSize: '1.25rem', letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: 'center', fontWeight: 700 }}
                    maxLength={6}
                  />
                </div>
                <div>
                  <Label htmlFor="join-role">Jeg er</Label>
                  <div style={{ marginTop: 6 }}>
                    <Select value={joinRole} onValueChange={setJoinRole}>
                      <SelectTrigger id="join-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="player">Spiller</SelectItem>
                        <SelectItem value="forelder">Forelder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setMode(null)}
                    disabled={joining}
                    style={{ flex: 1, height: 48, fontSize: '1rem', fontWeight: 500, background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}
                  >
                    Tilbake
                  </button>
                  <button
                    type="button"
                    onClick={handleJoin}
                    disabled={joining || !joinCode.trim()}
                    style={{ flex: 1, height: 48, fontSize: '1rem', fontWeight: 600, background: joining || !joinCode.trim() ? '#6ee7b7' : '#059669', color: '#fff', border: 'none', borderRadius: 8, cursor: joining || !joinCode.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    {joining && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                    Bli med
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Create team */}
          {mode === 'create' && (
            <>
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
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setMode(null)}
                      style={{ flex: 1, height: 48, fontSize: '1rem', fontWeight: 500, background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}
                    >
                      Tilbake
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (form.name && form.sport_type) setStep(2); }}
                      style={{ ...btnStyle(form.name && form.sport_type), flex: 1 }}
                    >
                      Neste <ArrowRight style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}