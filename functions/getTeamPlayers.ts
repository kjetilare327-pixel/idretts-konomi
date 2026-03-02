import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Fetches all Player records for a team.
// Only accessible by team admin roles (admin, kasserer, styreleder, revisor).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { team_id } = body;
    if (!team_id) return Response.json({ error: 'team_id required' }, { status: 400 });

    const userEmail = user.email.toLowerCase();

    // Verify the user is a member of this team with an admin role
    const ADMIN_ROLES = ['admin', 'kasserer', 'styreleder', 'revisor'];
    const members = await base44.asServiceRole.entities.TeamMember.filter({ team_id });
    const myMembership = members.find(m => m.user_email === userEmail && m.status === 'active');

    // Also allow team creator
    const teams = await base44.asServiceRole.entities.Team.filter({ id: team_id });
    const team = teams[0];
    const isCreator = team?.created_by === user.email;

    if (!myMembership && !isCreator) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const isAdminRole = isCreator || ADMIN_ROLES.includes(myMembership?.role);
    if (!isAdminRole) {
      return Response.json({ error: 'Admin role required' }, { status: 403 });
    }

    // Fetch all players for the team using service role (bypasses RLS)
    const players = await base44.asServiceRole.entities.Player.filter({ team_id });
    console.log(`[getTeamPlayers] team=${team_id} user=${userEmail} role=${myMembership?.role || 'creator'} → ${players.length} players`);

    return Response.json({ players, count: players.length });
  } catch (error) {
    console.error('[getTeamPlayers] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});