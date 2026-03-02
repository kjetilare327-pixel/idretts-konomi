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

    // Service role lookup — bypasses RLS entirely
    const teams = await base44.asServiceRole.entities.Team.filter({ join_code: cleanCode });
    console.log(`[joinTeamByCode] Teams found: ${teams.length}`);

    if (!teams || teams.length === 0) {
      console.log(`[joinTeamByCode] INVALID_CODE: ${cleanCode}`);
      return Response.json({ ok: false, code: 'INVALID_CODE', message: 'Ugyldig lagkode. Sjekk at du skrev riktig.' });
    }

    const team = teams[0];
    console.log(`[joinTeamByCode] Found team: ${team.id} — ${team.name}`);

    // Check existing membership
    const existing = await base44.asServiceRole.entities.TeamMember.filter({
      team_id: team.id,
      user_email: userEmail,
    });

    const activeRecord = existing.find(r => r.status === 'active');
    if (activeRecord) {
      console.log(`[joinTeamByCode] ALREADY_MEMBER: ${userEmail} in team ${team.id}`);
      return Response.json({ ok: true, code: 'ALREADY_MEMBER', team_id: team.id, team_name: team.name, role: activeRecord.role });
    }

    const invitedRecord = existing.find(r => r.status === 'invited');
    // Role: use invited record role if exists, otherwise use request role, default player
    const memberRole = invitedRecord?.role || (role === 'forelder' ? 'forelder' : 'player');

    if (invitedRecord) {
      await base44.asServiceRole.entities.TeamMember.update(invitedRecord.id, { status: 'active' });
      console.log(`[joinTeamByCode] Activated invited record: ${userEmail} as ${memberRole} in ${team.id}`);
    } else {
      await base44.asServiceRole.entities.TeamMember.create({
        team_id: team.id,
        user_email: userEmail,
        role: memberRole,
        status: 'active',
      });
      console.log(`[joinTeamByCode] Created new member: ${userEmail} as ${memberRole} in ${team.id}`);
    }

    return Response.json({ ok: true, code: 'JOINED', team_id: team.id, team_name: team.name, role: memberRole });

  } catch (error) {
    console.error(`[joinTeamByCode] ${ts} ERROR:`, error.message);
    return Response.json({ ok: false, code: 'UNKNOWN', message: 'Serverfeil: ' + error.message }, { status: 500 });
  }
});