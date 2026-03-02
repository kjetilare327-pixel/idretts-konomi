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
    const { join_code, role } = body;

    if (!join_code) {
      return Response.json({ ok: false, code: 'MISSING_CODE', message: 'Mangler lagkode' }, { status: 400 });
    }

    const cleanCode = join_code.trim().toUpperCase();
    const userEmail = user.email.toLowerCase();
    console.log(`[joinTeamByCode] ${ts} — user=${userEmail} code=${cleanCode} role=${role}`);

    // Strategy 1: Direct filter by join_code (fastest, works if service role filter is correct)
    let team = null;
    try {
      const directResults = await base44.asServiceRole.entities.Team.filter({ join_code: cleanCode });
      console.log(`[joinTeamByCode] Strategy1 (filter by join_code): ${directResults.length} results`);
      if (directResults.length > 0) {
        team = directResults[0];
      }
    } catch (e) {
      console.log(`[joinTeamByCode] Strategy1 failed: ${e.message}`);
    }

    // Strategy 2: filter({}) to get all teams, then find by code
    if (!team) {
      try {
        const allTeams = await base44.asServiceRole.entities.Team.filter({});
        console.log(`[joinTeamByCode] Strategy2 (filter all): ${allTeams.length} teams`);
        team = allTeams.find(t => t.join_code && t.join_code.trim().toUpperCase() === cleanCode) || null;
        if (team) console.log(`[joinTeamByCode] Strategy2 found team: ${team.id}`);
      } catch (e) {
        console.log(`[joinTeamByCode] Strategy2 failed: ${e.message}`);
      }
    }

    // Strategy 3: list() with large limit
    if (!team) {
      try {
        const listedTeams = await base44.asServiceRole.entities.Team.list('-created_date', 1000);
        console.log(`[joinTeamByCode] Strategy3 (list 1000): ${listedTeams.length} teams`);
        team = listedTeams.find(t => t.join_code && t.join_code.trim().toUpperCase() === cleanCode) || null;
        if (team) console.log(`[joinTeamByCode] Strategy3 found team: ${team.id}`);
      } catch (e) {
        console.log(`[joinTeamByCode] Strategy3 failed: ${e.message}`);
      }
    }

    if (!team) {
      // Check if ANY teams exist at all via all 3 strategies combined — distinguish INVALID_CODE from TECH_ERROR
      let totalKnownTeams = 0;
      try {
        const check = await base44.asServiceRole.entities.Team.filter({});
        totalKnownTeams = check.length;
      } catch (_) {}

      console.log(`[joinTeamByCode] NOT_FOUND — totalTeamsVisible=${totalKnownTeams} code=${cleanCode}`);

      if (totalKnownTeams === 0) {
        // Backend can't see ANY teams — this is a tech/config issue, not an invalid code
        return Response.json({
          ok: false,
          code: 'TECH_ERROR',
          message: 'Teknisk feil: serveren kan ikke lese lagdatabasen. Kontakt administrator.',
        }, { status: 500 });
      }

      return Response.json({ ok: false, code: 'INVALID_CODE', message: 'Ugyldig lagkode. Sjekk at du skrev riktig.' });
    }

    console.log(`[joinTeamByCode] Found team: ${team.id} — ${team.name}`);

    // Check existing membership
    let existing = [];
    try {
      existing = await base44.asServiceRole.entities.TeamMember.filter({
        team_id: team.id,
        user_email: userEmail,
      });
    } catch (e) {
      console.log(`[joinTeamByCode] TeamMember filter failed: ${e.message}`);
    }

    const activeRecord = existing.find(r => r.status === 'active');
    if (activeRecord) {
      console.log(`[joinTeamByCode] ALREADY_MEMBER: ${userEmail} in team ${team.id}`);
      return Response.json({ ok: true, code: 'ALREADY_MEMBER', team_id: team.id, team_name: team.name, role: activeRecord.role });
    }

    const invitedRecord = existing.find(r => r.status === 'invited');
    const memberRole = invitedRecord?.role || (role === 'forelder' ? 'forelder' : 'player');

    if (invitedRecord) {
      await base44.asServiceRole.entities.TeamMember.update(invitedRecord.id, { status: 'active' });
      console.log(`[joinTeamByCode] actionTaken=activated_invite user=${userEmail} role=${memberRole} team=${team.id}`);
    } else {
      await base44.asServiceRole.entities.TeamMember.create({
        team_id: team.id,
        user_email: userEmail,
        role: memberRole,
        status: 'active',
      });
      console.log(`[joinTeamByCode] actionTaken=created_member user=${userEmail} role=${memberRole} team=${team.id}`);
    }

    return Response.json({ ok: true, code: 'JOINED', team_id: team.id, team_name: team.name, role: memberRole });

  } catch (error) {
    console.error(`[joinTeamByCode] FATAL ERROR: ${error.message}`, error.stack);
    return Response.json({ ok: false, code: 'UNKNOWN', message: 'Serverfeil: ' + error.message }, { status: 500 });
  }
});