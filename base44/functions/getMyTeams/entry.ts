import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * getMyTeams — returns all active TeamMember records + their Team objects for the logged-in user.
 * Uses service role to bypass Team RLS (which requires currentTeamId — a chicken-and-egg problem).
 * Safe: only returns teams where the user has an active TeamMember record.
 */
Deno.serve(async (req) => {
  const ts = new Date().toISOString();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userEmail = user.email.toLowerCase();
    console.log(`[getMyTeams] ${ts} user=${userEmail}`);

    // Step 1: Get all active TeamMember records for this user (service role bypasses RLS)
    let memberRecords = [];
    try {
      memberRecords = await base44.asServiceRole.entities.TeamMember.filter({
        user_email: userEmail,
        status: 'active',
      });
      console.log(`[getMyTeams] Found ${memberRecords.length} active TeamMember records`);
    } catch (e) {
      console.error(`[getMyTeams] TeamMember.filter failed: ${e.message}`);
      return Response.json({ ok: false, code: 'MEMBER_FETCH_ERROR', message: e.message }, { status: 500 });
    }

    // Also get teams created by the user (they may not have a TeamMember row yet)
    let createdTeams = [];
    try {
      createdTeams = await base44.asServiceRole.entities.Team.filter({ created_by: user.email });
      console.log(`[getMyTeams] Found ${createdTeams.length} teams created by user`);
    } catch (e) {
      console.warn(`[getMyTeams] Team.filter(created_by) failed: ${e.message}`);
    }

    // Step 2: Fetch each team by id using service role
    const teamIds = [...new Set([
      ...memberRecords.map(m => m.team_id).filter(Boolean),
      ...createdTeams.map(t => t.id).filter(Boolean),
    ])];

    console.log(`[getMyTeams] Fetching ${teamIds.length} unique team(s) by id`);

    const teamMap = new Map();
    // Pre-populate from createdTeams
    for (const t of createdTeams) teamMap.set(t.id, t);

    // Fetch any missing ones
    const missingIds = teamIds.filter(id => !teamMap.has(id));
    if (missingIds.length > 0) {
      await Promise.all(missingIds.map(async (id) => {
        try {
          const results = await base44.asServiceRole.entities.Team.filter({ id });
          if (results.length > 0) {
            teamMap.set(id, results[0]);
            console.log(`[getMyTeams] Fetched team ${id}: ${results[0].name}`);
          } else {
            console.warn(`[getMyTeams] Team ${id} not found via service role`);
          }
        } catch (e) {
          console.warn(`[getMyTeams] Failed to fetch team ${id}: ${e.message}`);
        }
      }));
    }

    const teams = [...teamMap.values()];
    console.log(`[getMyTeams] Returning ${teams.length} teams, ${memberRecords.length} member records`);

    return Response.json({
      ok: true,
      teams,
      memberRecords,
      userEmail,
    });

  } catch (error) {
    console.error(`[getMyTeams] FATAL: ${error.message}`, error.stack);
    return Response.json({ ok: false, code: 'UNKNOWN', message: error.message }, { status: 500 });
  }
});