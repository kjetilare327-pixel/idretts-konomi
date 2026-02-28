import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';

const TOS_TEXT = `
**Vilkår for bruk – IdrettsØkonomi**
*Sist oppdatert: 1. mars 2026*

**1. Parter og avtale**
Disse vilkårene gjelder mellom deg (administrator for idrettslaget) og IdrettsØkonomi. Ved å opprette en konto aksepterer du disse vilkårene.

**2. Tjenesten**
IdrettsØkonomi er et digitalt verktøy for økonomistyring i idrettslag. Tjenesten er et hjelpemiddel – AI-baserte råd og analyser er veiledende og erstatter ikke profesjonell regnskapsrådgivning.

**3. Priser og betaling**
Tjenesten koster kr 89,– per måned per lag etter utløp av 14 dagers gratis prøveperiode. Betaling skjer månedlig via kortbetaling. Abonnementet fornyes automatisk og kan sies opp når som helst.

**4. Brukerens plikter**
Du er ansvarlig for at opplysningene som registreres er korrekte. Du plikter å holde innloggingsdetaljer hemmelig og varsle oss umiddelbart ved mistanke om misbruk.

**5. Ansvarsbegrensning**
IdrettsØkonomi er ikke ansvarlig for tap som følge av feil i systemet, misbruk av AI-råd, eller tap av data utover det som følger av norsk lov. Vår ansvarsbegrensning er begrenset til betalt abonnementsbeløp de siste 12 måneder.

**6. Oppsigelse**
Du kan si opp abonnementet når som helst fra innstillinger. Ved oppsigelse beholder du tilgang ut inneværende betalingsperiode.

**7. Lovvalg og verneting**
Disse vilkårene er underlagt norsk lov. Eventuelle tvister behandles ved Oslo tingrett.
`;

const PRIVACY_TEXT = `
**Personvernerklæring – IdrettsØkonomi**
*Sist oppdatert: 1. mars 2026*

**1. Behandlingsansvarlig**
IdrettsØkonomi er behandlingsansvarlig for personopplysninger som behandles i tjenesten.

**2. Hvilke data vi samler inn**
Vi samler inn: navn og e-postadresse (for innlogging), lagsinformasjon, transaksjons- og budsjettdata, spillerinformasjon og betalingsstatus.

**3. Formål med behandling**
Data brukes for å levere og forbedre tjenesten, sende varsler og påminnelser, og oppfylle lovpålagte regnskapskrav.

**4. Grunnlag for behandling**
Behandlingen er basert på avtale (art. 6 b) for leveranse av tjenesten, og samtykke (art. 6 a) der aktuelt.

**5. Deling med tredjeparter**
Vi deler data med Stripe for betalingsbehandling. Data deles ikke med andre tredjeparter uten samtykke.

**6. Datalagring**
Data lagres så lenge kontoen er aktiv. Ved avslutning slettes data innen 30 dager, med mindre lovpålagte oppbevaringsplikter gjelder.

**7. Dine rettigheter**
Du har rett til innsyn, retting, sletting, begrensning og portabilitet av dine data. Kontakt oss via innstillinger.

**8. Klage**
Du kan klage til Datatilsynet (datatilsynet.no) dersom du mener behandlingen er i strid med personvernregelverket.
`;

function renderText(text) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <br key={i} />;
    // Bold headings
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <p key={i} style={{ margin: '4px 0', fontSize: '0.8rem', lineHeight: 1.5, color: '#374151' }}>
        {parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        )}
      </p>
    );
  });
}

export default function TermsModal({ onAccepted }) {
  const [tosChecked, setTosChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('tos');
  const [saving, setSaving] = useState(false);

  const canProceed = tosChecked && privacyChecked;

  const handleAccept = async () => {
    if (!canProceed || saving) return;
    setSaving(true);
    try {
      await base44.auth.updateMe({
        tos_accepted: true,
        tos_accepted_at: new Date().toISOString(),
        privacy_accepted: true,
      });
    } catch (e) {
      console.warn('[TermsModal] updateMe failed (non-blocking):', e?.message);
    }
    onAccepted();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        width: '100%', maxWidth: 540,
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#111827' }}>
            Vilkår og personvern
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 6 }}>
            Les og aksepter vilkårene for å fortsette
          </p>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 16, borderBottom: '1px solid #e5e7eb' }}>
            {[['tos', 'Vilkår for bruk'], ['privacy', 'Personvern']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '8px 16px', fontSize: '0.85rem', fontWeight: 600,
                  border: 'none', background: 'none', cursor: 'pointer',
                  borderBottom: activeTab === key ? '2px solid #059669' : '2px solid transparent',
                  color: activeTab === key ? '#059669' : '#6b7280',
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 24px',
          background: '#f9fafb', margin: '0 0',
        }}>
          {activeTab === 'tos' ? renderText(TOS_TEXT) : renderText(PRIVACY_TEXT)}
        </div>

        {/* Checkboxes + button */}
        <div style={{ padding: '16px 24px 24px', flexShrink: 0, borderTop: '1px solid #e5e7eb' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={tosChecked}
              onChange={e => setTosChecked(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: '#059669', flexShrink: 0 }}
            />
            <span style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.5 }}>
              Jeg har lest og aksepterer <strong>vilkårene for bruk</strong>, inkludert at tjenesten koster kr 89/mnd etter prøveperioden, og at AI-råd er veiledende.
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={privacyChecked}
              onChange={e => setPrivacyChecked(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: '#059669', flexShrink: 0 }}
            />
            <span style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.5 }}>
              Jeg har lest og aksepterer <strong>personvernerklæringen</strong> og samtykker til behandling av personopplysninger som beskrevet.
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!canProceed || saving}
            style={{
              width: '100%', height: 48, fontSize: '1rem', fontWeight: 600,
              border: 'none', borderRadius: 10, cursor: canProceed && !saving ? 'pointer' : 'not-allowed',
              background: canProceed && !saving ? '#059669' : '#d1fae5',
              color: canProceed && !saving ? '#fff' : '#6b7280',
              transition: 'background 0.2s',
            }}
          >
            {saving ? 'Lagrer…' : 'Aksepter og fortsett'}
          </button>
        </div>
      </div>
    </div>
  );
}