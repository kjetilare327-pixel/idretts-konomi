import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { join_code, role } = body;

    if (!join_code) {
      return Response.json({ error: 'Mangler join_code' }, { status: 400 });
    }

    const cleanCode = join_code.trim().toUpperCase();
    console.log(`[joinTeamByCode] User ${user.email} trying to join with code: ${cleanCode}`);

    // CRITICAL: Use service role to find team by join_code (user has no RLS access yet)
    const allTeams = await base44.asServiceRole.entities.Team.filter({ join_code: cleanCode });
    console.log(`[joinTeamByCode] Teams found with code ${cleanCode}: ${allTeams.length}`);

    if (!allTeams || allTeams.length === 0) {
      console.log(`[joinTeamByCode] No team found with code ${cleanCode} - INVALID_CODE`);
      return Response.json({ error: 'Ugyldig lagkode. Sjekk at du skrev riktig kode.' }, { status: 404 });
    }

    const team = allTeams[0];
    console.log(`[joinTeamByCode] Found team: ${team.id} - ${team.name}`);

    // Check for existing TeamMember record via service role
    const existingRecords = await base44.asServiceRole.entities.TeamMember.filter({
      team_id: team.id,
      user_email: user.email.toLowerCase()
    });

    const activeRecord = existingRecords.find(r => r.status === 'active');
    if (activeRecord) {
      console.log(`[joinTeamByCode] ALREADY_MEMBER: ${user.email} in team ${team.id}`);
      return Response.json({ team_id: team.id, team_name: team.name, already_member: true, role: activeRecord.role });
    }

    const invitedRecord = existingRecords.find(r => r.status === 'invited');

    // Role priority: invited record role > request role > default 'player'
    const memberRole = invitedRecord?.role || (role === 'forelder' ? 'forelder' : 'player');

    if (invitedRecord) {
      await base44.asServiceRole.entities.TeamMember.update(invitedRecord.id, { status: 'active' });
      console.log(`[joinTeamByCode] Activated invited record: ${user.email} as ${memberRole} in team ${team.id}`);
    } else {
      await base44.asServiceRole.entities.TeamMember.create({
        team_id: team.id,
        user_email: user.email.toLowerCase(),
        role: memberRole,
        status: 'active',
      });
      console.log(`[joinTeamByCode] Created new TeamMember: ${user.email} as ${memberRole} in team ${team.id}`);
    }

    return Response.json({ team_id: team.id, team_name: team.name, already_member: false, role: memberRole });
  } catch (error) {
    console.error('[joinTeamByCode] Error:', error.message);
    return Response.json({ error: 'Serverfeil: ' + error.message }, { status: 500 });
  }
});