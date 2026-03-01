import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { join_code, role } = await req.json();

    if (!join_code || !role) {
      return Response.json({ error: 'join_code og role er påkrevd' }, { status: 400 });
    }

    const allowedRoles = ['player', 'forelder'];
    if (!allowedRoles.includes(role)) {
      return Response.json({ error: 'Ugyldig rolle. Velg player eller forelder.' }, { status: 400 });
    }

    // Find team by join_code - use filter with paginating through results
    let team = null;
    let offset = 0;
    const pageSize = 100;
    while (!team) {
      const teams = await base44.asServiceRole.entities.Team.list('id', pageSize, offset).catch(() => []);
      if (teams.length === 0) break;
      team = teams.find(t => t.join_code && t.join_code.toUpperCase() === join_code.trim().toUpperCase());
      if (!team && teams.length < pageSize) break;
      offset += pageSize;
    }

    if (!team) {
      return Response.json({ error: 'Ugyldig kode. Sjekk koden og prøv igjen.' }, { status: 404 });
    }

    const userEmail = user.email.toLowerCase();

    // Check if already a member
    const existing = await base44.asServiceRole.entities.TeamMember.filter({ team_id: team.id, user_email: userEmail });
    if (existing.length > 0) {
      return Response.json({ team_id: team.id, team_name: team.name, already_member: true });
    }

    // Create TeamMember
    await base44.asServiceRole.entities.TeamMember.create({
      team_id: team.id,
      user_email: userEmail,
      role,
      status: 'active',
      invited_by_email: 'join_code',
    });

    // Also create Player profile
    await base44.asServiceRole.entities.Player.create({
      team_id: team.id,
      user_email: userEmail,
      full_name: user.full_name || userEmail,
      role,
      status: 'active',
    }).catch(() => {}); // ignore if already exists

    return Response.json({ team_id: team.id, team_name: team.name, already_member: false });
  } catch (error) {
    console.error('[joinTeamByCode] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});