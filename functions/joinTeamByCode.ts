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
    console.log(`[joinTeamByCode] User ${user.email} trying to join with code ${cleanCode}`);

    // Use user-scoped entities to list teams (service role list() appears to return empty)
    // The user can read teams they created or are a member of, so we search all accessible teams
    const allTeams = await base44.entities.Team.list('-created_date', 500);
    console.log(`[joinTeamByCode] Teams accessible to user: ${allTeams.length}`);

    let team = allTeams.find(t => t.join_code && t.join_code.toUpperCase() === cleanCode);

    // If not found via user-scoped (user may not have access yet), try direct filter
    if (!team) {
      // Try fetching by searching all teams without RLS restriction using a workaround:
      // Use filter with the join_code field directly via user context
      // (Team.read RLS allows any authenticated user to read if they're in members - 
      //  but join_code lookup needs to work before they're a member)
      // We'll try the SDK filter approach
      const filtered = await base44.entities.Team.filter({ join_code: cleanCode }, '-created_date', 1);
      console.log(`[joinTeamByCode] Filter result: ${filtered.length}`);
      if (filtered.length > 0) team = filtered[0];
    }

    if (!team) {
      console.log(`[joinTeamByCode] No team found with code ${cleanCode}`);
      return Response.json({ error: 'Ugyldig lagkode. Sjekk at du skrev riktig.' }, { status: 404 });
    }

    console.log(`[joinTeamByCode] Found team: ${team.id} - ${team.name}`);

    // Check for an existing TeamMember record (invited or active)
    const existingTMRecords = await base44.asServiceRole.entities.TeamMember.filter({
      team_id: team.id,
      user_email: user.email.toLowerCase()
    }).catch(() => []);

    const activeRecord = existingTMRecords.find(r => r.status === 'active');
    if (activeRecord) {
      console.log(`[joinTeamByCode] User ${user.email} already active member`);
      return Response.json({ team_id: team.id, team_name: team.name, already_member: true });
    }

    const invitedRecord = existingTMRecords.find(r => r.status === 'invited');

    // Determine role: prefer from invitation record, then from request body, then default
    const memberRole = invitedRecord?.role || (role === 'forelder' ? 'forelder' : 'player');

    if (invitedRecord) {
      // Activate the existing invited record
      await base44.asServiceRole.entities.TeamMember.update(invitedRecord.id, {
        status: 'active',
        user_id: user.id || '',
      });
      console.log(`[joinTeamByCode] Activated invited record for ${user.email} in team ${team.id} as ${memberRole}`);
    } else {
      // No prior record — create fresh
      await base44.asServiceRole.entities.TeamMember.create({
        team_id: team.id,
        user_email: user.email.toLowerCase(),
        role: memberRole,
        status: 'active',
      });
      console.log(`[joinTeamByCode] Created new member record for ${user.email} in team ${team.id} as ${memberRole}`);
    }

    return Response.json({ team_id: team.id, team_name: team.name, already_member: false, role: memberRole });
  } catch (error) {
    console.error('[joinTeamByCode] Error:', error.message);
    return Response.json({ error: 'Serverfeil: ' + error.message }, { status: 500 });
  }
});