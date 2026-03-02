import React, { useEffect, useState, useRef } from 'react';
import { Shield, Loader2, AlertTriangle, RefreshCw, Copy, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const RETRY_COUNT = 6;
const RETRY_DELAY_MS = 500;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Returns { team, memberRecord } on success, null on all retries exhausted
async function retryFetchJoinedData(teamId, userEmail, attempts = RETRY_COUNT) {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(RETRY_DELAY_MS);

    console.log(`[JoinActivation] attempt ${i + 1}/${attempts} teamId=${teamId} user=${userEmail}`);

    try {
      const [members, teams] = await Promise.all([
        base44.entities.TeamMember.filter({ user_email: userEmail }).catch(() => []),
        base44.entities.Team.filter({ created_by: userEmail }).catch(() => []),
      ]);

      const activeMember = members.find(m => m.team_id === teamId && m.status === 'active');
      const teamObj = teams.find(t => t.id === teamId) || null;

      // Also try fetching team by id directly (works once RLS catches up)
      let resolvedTeam = teamObj;
      if (!resolvedTeam) {
        const byId = await base44.entities.Team.filter({ id: teamId }).catch(() => []);
        resolvedTeam = byId[0] || null;
      }

      console.log(`[JoinActivation] attempt ${i + 1}: activeMember=${!!activeMember} team=${!!resolvedTeam}`);

      if (activeMember || resolvedTeam) {
        return { team: resolvedTeam, memberRecord: activeMember || null };
      }
    } catch (e) {
      console.warn(`[JoinActivation] attempt ${i + 1} error:`, e.message);
    }
  }
  return null;
}

/**
 * Shown when pending_joined_team_id exists but normal boot can't confirm membership yet.
 * Retries fetching the joined team data, then calls onSuccess(bootData) or keeps showing error.
 */
export default function JoinActivationScreen({ teamId, teamName, user, onSuccess, onAbort }) {
  const [phase, setPhase] = useState('retrying'); // 'retrying' | 'failed'
  const [attempt, setAttempt] = useState(0);
  const [errorCode] = useState(() => `ERR-JOIN-${teamId?.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`);
  const [copied, setCopied] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    (async () => {
      const userEmail = user?.email?.toLowerCase();
      if (!userEmail || !teamId) {
        setPhase('failed');
        return;
      }

      for (let i = 0; i < RETRY_COUNT; i++) {
        if (i > 0) await sleep(RETRY_DELAY_MS);
        setAttempt(i + 1);

        try {
          const [members, teamsCreated] = await Promise.all([
            base44.entities.TeamMember.filter({ user_email: userEmail }).catch(() => []),
            base44.entities.Team.filter({ created_by: userEmail }).catch(() => []),
          ]);

          const activeMember = members.find(m => m.team_id === teamId && m.status === 'active');
          let resolvedTeam = teamsCreated.find(t => t.id === teamId) || null;
          if (!resolvedTeam) {
            const byId = await base44.entities.Team.filter({ id: teamId }).catch(() => []);
            resolvedTeam = byId[0] || null;
          }

          console.log(`[JoinActivation] attempt ${i + 1}/${RETRY_COUNT}: activeMember=${!!activeMember} team=${!!resolvedTeam}`);

          if (activeMember || resolvedTeam) {
            // Build the bootData for AuthGate to pass to TeamProvider
            const stub = resolvedTeam || { id: teamId, name: teamName || 'Laget ditt', join_code: '' };
            const memberStub = activeMember || { team_id: teamId, user_email: userEmail, status: 'active', role: 'player' };

            // Clear pending flag now that it succeeded
            try {
              localStorage.removeItem('pending_joined_team_id');
              localStorage.removeItem('pending_joined_team_name');
            } catch (_) {}

            localStorage.setItem('idrettsøkonomi_team_id', teamId);

            console.log(`[JoinActivation] SUCCESS on attempt ${i + 1} → calling onSuccess`);
            onSuccess({
              user,
              teams: [stub],
              memberTeams: [memberStub],
            });
            return;
          }
        } catch (e) {
          console.warn(`[JoinActivation] attempt ${i + 1} exception:`, e.message);
        }
      }

      console.error(`[JoinActivation] All ${RETRY_COUNT} attempts failed for teamId=${teamId}`);
      setPhase('failed');
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    setPhase('retrying');
    setAttempt(0);
    runningRef.current = false;
    // Re-trigger effect by forcing re-mount via key — parent handles via onAbort + re-mount
    // Simpler: just re-run directly
    runningRef.current = false;
    (async () => {
      runningRef.current = true;
      const userEmail = user?.email?.toLowerCase();
      for (let i = 0; i < RETRY_COUNT; i++) {
        if (i > 0) await sleep(RETRY_DELAY_MS);
        setAttempt(i + 1);
        try {
          const [members, teamsCreated] = await Promise.all([
            base44.entities.TeamMember.filter({ user_email: userEmail }).catch(() => []),
            base44.entities.Team.filter({ created_by: userEmail }).catch(() => []),
          ]);
          const activeMember = members.find(m => m.team_id === teamId && m.status === 'active');
          let resolvedTeam = teamsCreated.find(t => t.id === teamId) || null;
          if (!resolvedTeam) {
            const byId = await base44.entities.Team.filter({ id: teamId }).catch(() => []);
            resolvedTeam = byId[0] || null;
          }
          if (activeMember || resolvedTeam) {
            const stub = resolvedTeam || { id: teamId, name: teamName || 'Laget ditt', join_code: '' };
            const memberStub = activeMember || { team_id: teamId, user_email: userEmail, status: 'active', role: 'player' };
            try {
              localStorage.removeItem('pending_joined_team_id');
              localStorage.removeItem('pending_joined_team_name');
            } catch (_) {}
            localStorage.setItem('idrettsøkonomi_team_id', teamId);
            onSuccess({ user, teams: [stub], memberTeams: [memberStub] });
            return;
          }
        } catch (_) {}
      }
      setPhase('failed');
    })();
  };

  const handleCopyError = () => {
    navigator.clipboard.writeText(`Feilkode: ${errorCode}\nTeamId: ${teamId}\nBruker: ${user?.email}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: 24,
    }}>
      <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ width: 56, height: 56, borderRadius: 16, background: phase === 'failed' ? '#fee2e2' : '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        {phase === 'failed'
          ? <AlertTriangle style={{ width: 28, height: 28, color: '#dc2626' }} />
          : <Shield style={{ width: 28, height: 28, color: '#059669' }} />
        }
      </div>

      {phase === 'retrying' && (
        <>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Aktiverer laget…</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 24, textAlign: 'center' }}>
            {teamName ? `Kobler til «${teamName}»` : 'Verifiserer medlemskap'} ({attempt}/{RETRY_COUNT})
          </p>
          <div style={{ width: 32, height: 32, border: '3px solid #d1fae5', borderTopColor: '#059669', borderRadius: '50%', animation: '_spin 0.8s linear infinite' }} />
        </>
      )}

      {phase === 'failed' && (
        <>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, textAlign: 'center', color: '#dc2626' }}>Kunne ikke aktivere laget</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 8, textAlign: 'center', maxWidth: 360 }}>
            Du ble lagt til i laget, men appen klarte ikke å laste det inn. Prøv igjen, eller kontakt support.
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: 24, fontFamily: 'monospace' }}>{errorCode}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
            <button
              onClick={handleRetry}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, background: '#059669', color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}
            >
              <RefreshCw style={{ width: 16, height: 16 }} /> Prøv igjen
            </button>
            <button
              onClick={handleCopyError}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
            >
              {copied ? <CheckCircle style={{ width: 16, height: 16, color: '#059669' }} /> : <Copy style={{ width: 16, height: 16 }} />}
              {copied ? 'Kopiert!' : 'Kopier feilkode til support'}
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