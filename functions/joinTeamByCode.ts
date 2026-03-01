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

    if (!join_code || !role) {
      return Response.json({ error: 'Missing join_code or role' }, { status: 400 });
    }

    console.log(`[joinTeamByCode] User ${user.email} trying to join with code ${join_code}`);

    // Find team by join_code using filter (works with RLS)
    const teams = await base44.asServiceRole.entities.Team.filter(
      { join_code: join_code.toUpperCase() },
      '-created_date',
      1
    );

    if (!teams || teams.length === 0) {
      console.log(`[joinTeamByCode] No team found with code ${join_code}`);
      return Response.json({ error: 'Ugyldig lagkode' }, { status: 404 });
    }

    const team = teams[0];
    console.log(`[joinTeamByCode] Found team ${team.id} - ${team.name}`);

    // Check if already a member
    const existingMembers = team.members || [];
    const alreadyMember = existingMembers.some(m => m.email === user.email);

    if (alreadyMember) {
      console.log(`[joinTeamByCode] User ${user.email} already member of ${team.id}`);
      return Response.json({
        team_id: team.id,
        team_name: team.name,
        already_member: true
      });
    }

    // Add user to team members
    const updatedMembers = [
      ...existingMembers,
      {
        email: user.email,
        role: role === 'player' ? 'player' : 'forelder'
      }
    ];

    await base44.asServiceRole.entities.Team.update(team.id, {
      members: updatedMembers
    });

    // Create TeamMember record
    await base44.asServiceRole.entities.TeamMember.create({
      team_id: team.id,
      user_email: user.email,
      role: role === 'player' ? 'player' : 'forelder',
      status: 'active'
    });

    // Update user's currentTeamId
    await base44.auth.updateMe({
      currentTeamId: team.id,
      in_app_role: role === 'player' ? 'player' : 'forelder'
    });

    console.log(`[joinTeamByCode] Successfully added user ${user.email} to team ${team.id}`);

    return Response.json({
      team_id: team.id,
      team_name: team.name,
      already_member: false
    });
  } catch (error) {
    console.error('[joinTeamByCode] Error:', error.message);
    return Response.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
});