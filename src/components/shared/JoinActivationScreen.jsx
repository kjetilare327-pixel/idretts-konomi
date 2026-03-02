import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Shield, AlertTriangle, RefreshCw, Copy, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Exponential backoff: ~15 seconds total across 10 attempts
const BACKOFF_MS = [400, 600, 900, 1300, 1800, 2500, 2000, 1500, 1200, 1000];
const MAX_ATTEMPTS = BACKOFF_MS.length;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * JoinActivationScreen
 *
 * Calls getJoinStatus(team_id) — a service-role backed backend function —
 * to deterministically verify:
 *   A) TeamMember(active) exists for this user + team
 *   B) Team object is readable
 *
 * BOTH must be true before calling onSuccess. Never bounces to Onboarding.
 */
export default function JoinActivationScreen({ teamId, teamName, user, onSuccess, onAbort }) {
  const [phase, setPhase] = useState('retrying'); // 'retrying' | 'failed'
  const [attempt, setAttempt] = useState(0);
  const [diagLine, setDiagLine] = useState('');
  const [copied, setCopied] = useState(false);
  const runningRef = useRef(false);
  const lastDiagRef = useRef('');

  const errorCode = useRef(
    `ERR-JOIN-${(teamId || '??????').slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
  ).current;

  const runLoop = useCallback(async () => {
    const userEmail = user?.email?.toLowerCase();
    if (!userEmail || !teamId) {
      console.error('[JoinActivation] Missing userEmail or teamId');
      setDiagLine('userEmail or teamId mangler');
      setPhase('failed');
      return;
    }

    console.log(`[JoinActivation] START activation teamId=${teamId} user=${userEmail} maxAttempts=${MAX_ATTEMPTS}`);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (i > 0) await sleep(BACKOFF_MS[i]);
      setAttempt(i + 1);

      try {
        const res = await base44.functions.invoke('getJoinStatus', { team_id: teamId });
        const data = res?.data;

        if (!data?.ok) {
          const diag = `#${i+1} getJoinStatus ok=false code=${data?.code || 'unknown'}`;
          console.warn(`[JoinActivation] ${diag}`);
          lastDiagRef.current = diag;
          setDiagLine(diag);
          continue;
        }

        const { memberFound, teamFound, teamMemberId, teamName: resolvedName, requestId } = data;

        const diag = `#${i+1}/${MAX_ATTEMPTS} reqId=${requestId} memberFound=${memberFound} teamFound=${teamFound}`;
        console.log(`[JoinActivation] ${diag}`);
        lastDiagRef.current = diag;
        setDiagLine(diag);

        if (memberFound && teamFound) {
          console.log(`[JoinActivation] ✓ SUCCESS attempt=${i+1} reqId=${requestId} teamMemberId=${teamMemberId} → calling onSuccess`);

          try {
            localStorage.removeItem('pending_joined_team_id');
            localStorage.removeItem('pending_joined_team_name');
            localStorage.setItem('idrettsøkonomi_team_id', teamId);
          } catch (_) {}

          // Use getMyTeams to get full bootData (service role, all teams)
          let bootTeams = [{ id: teamId, name: resolvedName || teamName || 'Laget ditt' }];
          let bootMembers = [{ team_id: teamId, user_email: userEmail, status: 'active', role: 'player', id: teamMemberId }];

          try {
            const myTeamsRes = await base44.functions.invoke('getMyTeams', {});
            if (myTeamsRes?.data?.ok && myTeamsRes.data.teams?.length > 0) {
              bootTeams = myTeamsRes.data.teams;
              bootMembers = myTeamsRes.data.memberRecords || bootMembers;
            }
          } catch (_) {}

          onSuccess({ user, teams: bootTeams, memberTeams: bootMembers });
          return;
        }

      } catch (e) {
        const diag = `#${i+1} exception: ${e?.message || e}`;
        console.warn(`[JoinActivation] ${diag}`);
        lastDiagRef.current = diag;
        setDiagLine(diag);
      }
    }

    console.error(`[JoinActivation] ✗ All ${MAX_ATTEMPTS} attempts failed — ${errorCode} lastDiag=${lastDiagRef.current}`);
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
    setDiagLine('');
    runningRef.current = false;
    setTimeout(() => {
      if (!runningRef.current) {
        runningRef.current = true;
        runLoop();
      }
    }, 80);
  };

  const handleCopyError = () => {
    const text = [
      `Feilkode: ${errorCode}`,
      `TeamId (siste 6): ${(teamId || '').slice(-6)}`,
      `Bruker: ${user?.email || 'ukjent'}`,
      `Siste diagnostikk: ${lastDiagRef.current}`,
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Aktiverer laget…</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 6, textAlign: 'center' }}>
            {teamName ? `Kobler til «${teamName}»` : 'Verifiserer medlemskap'}
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.7rem', marginBottom: 24, textAlign: 'center', fontFamily: 'monospace', maxWidth: 380 }}>
            {diagLine || `Forsøk ${attempt}/${MAX_ATTEMPTS}…`}
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
            Medlemskapet ble opprettet men kunne ikke verifiseres etter {MAX_ATTEMPTS} forsøk. Prøv igjen.
          </p>
          {diagLine && (
            <p style={{ color: '#94a3b8', fontSize: '0.7rem', marginBottom: 8, fontFamily: 'monospace', textAlign: 'center', maxWidth: 380 }}>
              {diagLine}
            </p>
          )}
          <p style={{ color: '#cbd5e1', fontSize: '0.7rem', marginBottom: 24, fontFamily: 'monospace' }}>{errorCode}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
            <button onClick={handleRetry} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              height: 48, background: '#059669', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
            }}>
              <RefreshCw style={{ width: 16, height: 16 }} /> Prøv igjen
            </button>
            <button onClick={handleCopyError} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              height: 48, background: '#f1f5f9', color: '#475569',
              border: '1px solid #e2e8f0', borderRadius: 10, fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
            }}>
              {copied ? <CheckCircle style={{ width: 16, height: 16, color: '#059669' }} /> : <Copy style={{ width: 16, height: 16 }} />}
              {copied ? 'Kopiert!' : 'Kopier diagnostikk til support'}
            </button>
            <button
              onClick={() => {
                try { localStorage.removeItem('pending_joined_team_id'); localStorage.removeItem('pending_joined_team_name'); } catch (_) {}
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