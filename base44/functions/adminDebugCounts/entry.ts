import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Debug endpoint: returns counts of Players and TeamMembers for a team.
// Only accessible by team admins or team creators.
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

    // Fetch team and memberships using service role
    const [teams, allMembers] = await Promise.all([
      base44.asServiceRole.entities.Team.filter({ id: team_id }),
      base44.asServiceRole.entities.TeamMember.filter({ team_id }),
    ]);
    const team = teams[0];

    const isCreator = (team?.created_by || '').toLowerCase() === userEmail;
    const myMembership = allMembers.find(m =>
      (m.user_email || '').toLowerCase() === userEmail &&
      m.status === 'active' &&
      ADMIN_ROLES.includes(m.role)
    );

    if (!isCreator && !myMembership) {
      return Response.json({ error: 'Admin required', userEmail, teamCreatedBy: team?.created_by }, { status: 403 });
    }

    // Fetch all players for team via service role
    const players = await base44.asServiceRole.entities.Player.filter({ team_id });

    // Mask emails partially
    const maskEmail = (email) => {
      if (!email) return '';
      const [local, domain] = email.split('@');
      return local.slice(0, 2) + '***@' + (domain || '');
    };

    const samplePlayers = players.slice(0, 3).map(p => ({
      id: p.id,
      full_name: p.full_name,
      email_masked: maskEmail(p.user_email),
      role: p.role,
      status: p.status,
      team_id: p.team_id,
      created_date: p.created_date,
    }));

    return Response.json({
      ok: true,
      team_id,
      team_name: team?.name,
      team_created_by: maskEmail(team?.created_by),
      caller_email: maskEmail(userEmail),
      caller_role: myMembership?.role || (isCreator ? 'creator' : 'unknown'),
      counts: {
        players: players.length,
        team_members: allMembers.length,
      },
      sample_players: samplePlayers,
      all_members_roles: allMembers.map(m => ({
        email_masked: maskEmail(m.user_email),
        role: m.role,
        status: m.status,
      })),
    });
  } catch (error) {
    console.error('[adminDebugCounts] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});