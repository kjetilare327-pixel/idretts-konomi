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

    const [members, teams] = await Promise.all([
      base44.asServiceRole.entities.TeamMember.filter({ team_id }),
      base44.asServiceRole.entities.Team.filter({ id: team_id }),
    ]);
    const team = teams[0];
    const isCreator = team?.created_by === user.email;

    // Check all memberships for this user (by both email and lowercased email)
    const myMemberships = members.filter(m =>
      (m.user_email || '').toLowerCase() === userEmail && m.status === 'active'
    );
    const myAdminMembership = myMemberships.find(m => ADMIN_ROLES.includes(m.role));

    // Also allow via Team.members legacy array
    const legacyMember = team?.members?.find(m => (m.email || '').toLowerCase() === userEmail);
    const isLegacyAdmin = legacyMember && ADMIN_ROLES.includes(legacyMember.role);

    const isAdminRole = isCreator || !!myAdminMembership || isLegacyAdmin;
    // For admin users calling on behalf of a team they own (creator), always allow
    console.log(`[getTeamPlayers] user=${userEmail} isCreator=${isCreator} myMemberships=${myMemberships.map(m=>m.role)} isAdmin=${isAdminRole}`);

    if (!isAdminRole) {
      return Response.json({ error: 'Admin role required', userEmail, roles: myMemberships.map(m => m.role), teamCreatedBy: team?.created_by }, { status: 403 });
    }

    // Fetch all players for the team using service role (bypasses RLS)
    const players = await base44.asServiceRole.entities.Player.filter({ team_id });
    console.log(`[getTeamPlayers] team=${team_id} user=${userEmail} role=${myMembership?.role || (isCreator ? 'creator' : 'legacy')} → ${players.length} players`);

    return Response.json({ players, count: players.length });
  } catch (error) {
    console.error('[getTeamPlayers] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});