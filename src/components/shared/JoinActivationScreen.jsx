import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Shield, AlertTriangle, RefreshCw, Copy, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Exponential backoff delays: ~13 seconds total across 10 attempts
const BACKOFF_MS = [300, 500, 800, 1200, 1800, 2500, 1500, 1000, 800, 600];
const MAX_ATTEMPTS = BACKOFF_MS.length;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * JoinActivationScreen
 *
 * Shown when pending_joined_team_id is set in localStorage.
 * Verifies membership in order:
 *   Step A: TeamMember(user_email, team_id) with status=active exists
 *   Step B: Team read-by-id succeeds (RLS propagated)
 *   Step C: Build bootData and call onSuccess
 *
 * Uses exponential backoff over ~13 seconds. Never bounces to Onboarding.
 */
export default function JoinActivationScreen({ teamId, teamName, user, onSuccess, onAbort }) {
  const [phase, setPhase] = useState('retrying'); // 'retrying' | 'failed'
  const [attempt, setAttempt] = useState(0);
  const [lastDiag, setLastDiag] = useState(null); // { memberFound, teamFound, failedStep }
  const [copied, setCopied] = useState(false);
  const runningRef = useRef(false);

  const errorCode = useRef(
    `ERR-JOIN-${(teamId || '??????').slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
  ).current;

  const runLoop = useCallback(async () => {
    const userEmail = user?.email?.toLowerCase();
    if (!userEmail || !teamId) {
      console.error('[JoinActivation] Missing userEmail or teamId — cannot activate');
      setPhase('failed');
      return;
    }

    console.log(`[JoinActivation] Starting activation loop for teamId=${teamId} user=${userEmail} maxAttempts=${MAX_ATTEMPTS}`);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (i > 0) await sleep(BACKOFF_MS[i]);
      setAttempt(i + 1);

      let memberFound = false;
      let teamFound = false;
      let failedStep = null;
      let memberRecord = null;
      let teamObj = null;

      try {
        // ── Step A: Check TeamMember ──────────────────────────────────────────
        const members = await base44.entities.TeamMember.filter({ user_email: userEmail }).catch(e => {
          console.warn(`[JoinActivation] #${i+1} TeamMember.filter error:`, e?.message || e);
          return [];
        });

        memberRecord = members.find(m => m.team_id === teamId && m.status === 'active') || null;
        memberFound = !!memberRecord;

        if (!memberFound) failedStep = 'A';

        // ── Step B: Check Team read ───────────────────────────────────────────
        // Try filter by id (works once RLS currentTeamId propagates)
        const teamsById = await base44.entities.Team.filter({ id: teamId }).catch(e => {
          console.warn(`[JoinActivation] #${i+1} Team.filter({id}) error:`, e?.message || e);
          return [];
        });
        teamObj = teamsById[0] || null;

        // Fallback: list all teams the user can see
        if (!teamObj) {
          const allTeams = await base44.entities.Team.list().catch(() => []);
          teamObj = allTeams.find(t => t.id === teamId) || null;
        }

        // Fallback: check created_by
        if (!teamObj) {
          const created = await base44.entities.Team.filter({ created_by: userEmail }).catch(() => []);
          teamObj = created.find(t => t.id === teamId) || null;
        }

        teamFound = !!teamObj;
        if (!teamFound && failedStep === null) failedStep = 'B';

        const diag = { memberFound, teamFound, failedStep, attempt: i + 1 };
        setLastDiag(diag);

        console.log(
          `[JoinActivation] #${i+1}/${MAX_ATTEMPTS} — ` +
          `memberFound=${memberFound} teamFound=${teamFound} failedStep=${failedStep || 'none'}`
        );

        // ── Step C: Success condition ─────────────────────────────────────────
        // We need at minimum: memberFound OR teamFound (one is enough to proceed)
        // Ideally both. But if member is confirmed, we can trust the join even if team RLS is slow.
        if (memberFound || teamFound) {
          const resolvedTeam = teamObj || { id: teamId, name: teamName || 'Laget ditt', join_code: '' };
          const resolvedMember = memberRecord || {
            team_id: teamId,
            user_email: userEmail,
            status: 'active',
            role: 'player',
          };

          console.log(
            `[JoinActivation] ✓ SUCCESS at attempt ${i+1} — ` +
            `teamMemberFound=${memberFound} teamFound=${teamFound} → activated`
          );

          try {
            localStorage.removeItem('pending_joined_team_id');
            localStorage.removeItem('pending_joined_team_name');
            localStorage.setItem('idrettsøkonomi_team_id', teamId);
          } catch (_) {}

          onSuccess({
            user,
            teams: [resolvedTeam],
            memberTeams: [resolvedMember],
          });
          return;
        }

      } catch (e) {
        console.warn(`[JoinActivation] #${i+1} unexpected exception:`, e?.message || e);
        setLastDiag({ memberFound: false, teamFound: false, failedStep: 'exception', attempt: i + 1 });
      }
    }

    console.error(`[JoinActivation] ✗ All ${MAX_ATTEMPTS} attempts exhausted for teamId=${teamId} — errorCode=${errorCode}`);
    setPhase('failed');
  }, [teamId, teamName, user, onSuccess, errorCode]);

  useEffect(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    runLoop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    setPhase('retrying');
    setAttempt(0);
    setLastDiag(null);
    runningRef.current = false;
    // Small delay so state flushes before starting
    setTimeout(() => {
      if (!runningRef.current) {
        runningRef.current = true;
        runLoop();
      }
    }, 100);
  };

  const handleCopyError = () => {
    const diagStr = lastDiag
      ? `memberFound=${lastDiag.memberFound} teamFound=${lastDiag.teamFound} failedStep=${lastDiag.failedStep} attempts=${lastDiag.attempt}`
      : 'no diag';
    const text = [
      `Feilkode: ${errorCode}`,
      `TeamId (siste 6): ${(teamId || '').slice(-6)}`,
      `Bruker: ${user?.email || 'ukjent'}`,
      `Diagnostikk: ${diagStr}`,
    ].join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: 24,
    }}>
      <style>{`@keyframes _jaspin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: phase === 'failed' ? '#fee2e2' : '#d1fae5',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
      }}>
        {phase === 'failed'
          ? <AlertTriangle style={{ width: 28, height: 28, color: '#dc2626' }} />
          : <Shield style={{ width: 28, height: 28, color: '#059669' }} />
        }
      </div>

      {phase === 'retrying' && (
        <>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
            Aktiverer laget…
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 6, textAlign: 'center' }}>
            {teamName ? `Kobler til «${teamName}»` : 'Verifiserer medlemskap'}
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: 24, textAlign: 'center' }}>
            Forsøk {attempt} av {MAX_ATTEMPTS}
            {lastDiag && (
              <span style={{ display: 'block', fontFamily: 'monospace', marginTop: 4, fontSize: '0.7rem' }}>
                member={String(lastDiag.memberFound)} team={String(lastDiag.teamFound)}
                {lastDiag.failedStep ? ` failedStep=${lastDiag.failedStep}` : ''}
              </span>
            )}
          </p>
          <div style={{
            width: 32, height: 32,
            border: '3px solid #d1fae5', borderTopColor: '#059669',
            borderRadius: '50%', animation: '_jaspin 0.8s linear infinite',
          }} />
        </>
      )}

      {phase === 'failed' && (
        <>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, textAlign: 'center', color: '#dc2626' }}>
            Kunne ikke aktivere laget
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 8, textAlign: 'center', maxWidth: 360 }}>
            Du ble lagt til i laget, men appen klarte ikke å laste det inn etter {MAX_ATTEMPTS} forsøk. Prøv igjen.
          </p>
          {lastDiag && (
            <p style={{ color: '#94a3b8', fontSize: '0.7rem', marginBottom: 8, fontFamily: 'monospace', textAlign: 'center' }}>
              member={String(lastDiag.memberFound)} team={String(lastDiag.teamFound)} step={lastDiag.failedStep}
            </p>
          )}
          <p style={{ color: '#cbd5e1', fontSize: '0.7rem', marginBottom: 24, fontFamily: 'monospace' }}>
            {errorCode}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
            <button
              onClick={handleRetry}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                height: 48, background: '#059669', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <RefreshCw style={{ width: 16, height: 16 }} /> Prøv igjen
            </button>
            <button
              onClick={handleCopyError}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                height: 48, background: '#f1f5f9', color: '#475569',
                border: '1px solid #e2e8f0', borderRadius: 10, fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
              }}
            >
              {copied
                ? <CheckCircle style={{ width: 16, height: 16, color: '#059669' }} />
                : <Copy style={{ width: 16, height: 16 }} />
              }
              {copied ? 'Kopiert!' : 'Kopier diagnostikk til support'}
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('pending_joined_team_id');
                  localStorage.removeItem('pending_joined_team_name');
                } catch (_) {}
                onAbort();
              }}
              style={{ height: 44, background: 'transparent', color: '#94a3b8', border: 'none', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Avbryt og gå tilbake
            </button>
          </div>
        </>
      )}
    </div>
  );
}