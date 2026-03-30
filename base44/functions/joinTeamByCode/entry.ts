import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const ts = new Date().toISOString();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, code: 'UNAUTHORIZED', message: 'Ikke innlogget' }, { status: 401 });
    }

    const body = await req.json();
    const { join_code, role, full_name } = body;

    if (!join_code) {
      return Response.json({ ok: false, code: 'MISSING_CODE', message: 'Mangler lagkode' }, { status: 400 });
    }

    const cleanCode = join_code.trim().toUpperCase();
    const userEmail = user.email.toLowerCase();
    const displayName = (full_name || '').trim() || userEmail;
    console.log(`[joinTeamByCode] ${ts} — user=${userEmail} code=${cleanCode} role=${role} name=${displayName}`);

    // Find team by join code
    let team = null;
    try {
      const directResults = await base44.asServiceRole.entities.Team.filter({ join_code: cleanCode });
      if (directResults.length > 0) team = directResults[0];
    } catch (e) {
      console.log(`[joinTeamByCode] Strategy1 failed: ${e.message}`);
    }

    if (!team) {
      try {
        const allTeams = await base44.asServiceRole.entities.Team.filter({});
        team = allTeams.find(t => t.join_code && t.join_code.trim().toUpperCase() === cleanCode) || null;
      } catch (e) {
        console.log(`[joinTeamByCode] Strategy2 failed: ${e.message}`);
      }
    }

    if (!team) {
      return Response.json({ ok: false, code: 'INVALID_CODE', message: 'Ugyldig lagkode. Sjekk at du skrev riktig.' });
    }

    console.log(`[joinTeamByCode] Found team: ${team.id} — ${team.name}`);

    // Check existing membership
    let existing = [];
    try {
      const byTeam = await base44.asServiceRole.entities.TeamMember.filter({ team_id: team.id });
      existing = byTeam.filter(r => r.user_email === userEmail);
    } catch (e) {
      console.log(`[joinTeamByCode] TeamMember filter failed: ${e.message}`);
    }

    const activeRecord = existing.find(r => r.status === 'active');
    const memberRole = activeRecord?.role || existing.find(r => r.status === 'invited')?.role || (role === 'forelder' ? 'forelder' : (role === 'player' ? 'player' : 'forelder'));

    if (!activeRecord) {
      const invitedRecord = existing.find(r => r.status === 'invited');
      if (invitedRecord) {
        await base44.asServiceRole.entities.TeamMember.update(invitedRecord.id, { status: 'active' });
        console.log(`[joinTeamByCode] Activated invite for ${userEmail} role=${memberRole}`);
      } else {
        await base44.asServiceRole.entities.TeamMember.create({
          team_id: team.id,
          user_email: userEmail,
          role: memberRole,
          status: 'active',
        });
        console.log(`[joinTeamByCode] Created TeamMember for ${userEmail} role=${memberRole}`);
      }
    } else {
      console.log(`[joinTeamByCode] Already active member: ${userEmail}`);
    }

    // ── Create or update Player profile (idempotent by team_id + user_email) ──
    const playerRole = memberRole === 'forelder' ? 'parent' : 'player';
    let existingPlayers = [];
    try {
      const allByTeam = await base44.asServiceRole.entities.Player.filter({ team_id: team.id });
      existingPlayers = allByTeam.filter(p => p.user_email === userEmail);
    } catch (e) {
      console.log(`[joinTeamByCode] Player lookup failed: ${e.message}`);
    }

    if (existingPlayers.length > 0) {
      // Update existing profile (idempotent)
      await base44.asServiceRole.entities.Player.update(existingPlayers[0].id, {
        full_name: displayName,
        role: playerRole,
        status: 'active',
      });
      console.log(`[joinTeamByCode] Updated Player profile: ${existingPlayers[0].id}`);
    } else {
      const newPlayer = await base44.asServiceRole.entities.Player.create({
        team_id: team.id,
        user_email: userEmail,
        full_name: displayName,
        role: playerRole,
        status: 'active',
        balance: 0,
        payment_status: 'paid',
      });
      console.log(`[joinTeamByCode] Created Player profile: ${newPlayer.id} name=${displayName}`);
    }

    // Audit log
    if (!activeRecord) {
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          team_id: team.id,
          user_email: userEmail,
          action: 'create',
          entity_type: 'TeamMember',
          entity_id: team.id,
          description: `Bruker ${userEmail} ble med i lag ${team.name} via kode`,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[joinTeamByCode] AuditLog failed (non-blocking):', e.message);
      }
    }

    return Response.json({
      ok: true,
      code: activeRecord ? 'ALREADY_MEMBER' : 'JOINED',
      team_id: team.id,
      team_name: team.name,
      role: memberRole,
    });

  } catch (error) {
    console.error(`[joinTeamByCode] FATAL ERROR: ${error.message}`, error.stack);
    return Response.json({ ok: false, code: 'UNKNOWN', message: 'Serverfeil: ' + error.message }, { status: 500 });
  }
});