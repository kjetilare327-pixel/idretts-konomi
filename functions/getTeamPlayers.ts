import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Fetches all Player records for a team.
// Only accessible by team admin roles (admin, kasserer, styreleder, revisor) OR team creator.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { team_id } = body;
    if (!team_id) return Response.json({ error: 'team_id required' }, { status: 400 });

    const userEmail = user.email.toLowerCase();
    const ADMIN_ROLES = ['admin', 'kasserer', 'styreleder', 'revisor'];

    // Use service role to bypass RLS for the auth checks
    const [allMembers, teams] = await Promise.all([
      base44.asServiceRole.entities.TeamMember.filter({ team_id }),
      base44.asServiceRole.entities.Team.filter({ id: team_id }),
    ]);
    const team = teams[0];

    // Check 1: is team creator?
    const isCreator = (team?.created_by || '').toLowerCase() === userEmail;

    // Check 2: active admin-role TeamMember?
    const myAdminMembership = allMembers.find(m =>
      (m.user_email || '').toLowerCase() === userEmail &&
      m.status === 'active' &&
      ADMIN_ROLES.includes(m.role)
    );

    const isAuthorized = isCreator || !!myAdminMembership;

    console.log(`[getTeamPlayers] user=${userEmail} team=${team_id} isCreator=${isCreator} adminMembership=${myAdminMembership?.role || 'none'} authorized=${isAuthorized}`);

    if (!isAuthorized) {
      const myRoles = allMembers
        .filter(m => (m.user_email || '').toLowerCase() === userEmail)
        .map(m => `${m.role}(${m.status})`);
      return Response.json({
        error: 'Forbidden: admin role required',
        userEmail,
        myRoles,
        teamCreatedBy: team?.created_by,
      }, { status: 403 });
    }

    // Fetch all players using service role (bypasses RLS)
    const players = await base44.asServiceRole.entities.Player.filter({ team_id });
    console.log(`[getTeamPlayers] returning ${players.length} players for team ${team_id}`);

    return Response.json({ ok: true, players, count: players.length });
  } catch (error) {
    console.error('[getTeamPlayers] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});