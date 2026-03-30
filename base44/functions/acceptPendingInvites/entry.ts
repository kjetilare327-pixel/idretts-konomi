import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Called at boot time by AuthGate to auto-activate any 'invited' TeamMember records for the logged-in user.
// Also ensures a Player profile exists for each activated membership.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userEmail = user.email.toLowerCase();
    const displayName = user.full_name || userEmail;

    // Use service role to find all invited records for this user
    const allMemberRecords = await base44.asServiceRole.entities.TeamMember.filter({ user_email: userEmail });
    const invitedRecords = allMemberRecords.filter(r => r.status === 'invited');

    console.log(`[acceptPendingInvites] Found ${invitedRecords.length} pending invite(s) for ${userEmail}`);

    if (invitedRecords.length === 0) {
      return Response.json({ activated: 0 });
    }

    let activated = 0;
    for (const record of invitedRecords) {
      // Activate TeamMember
      await base44.asServiceRole.entities.TeamMember.update(record.id, { status: 'active' });
      console.log(`[acceptPendingInvites] Activated: team=${record.team_id} role=${record.role}`);
      activated++;

      // Ensure Player profile exists
      const playerRole = record.role === 'forelder' ? 'parent' : 'player';
      try {
        const allByTeam = await base44.asServiceRole.entities.Player.filter({ team_id: record.team_id });
        const existing = allByTeam.find(p => p.user_email === userEmail);
        if (!existing) {
          await base44.asServiceRole.entities.Player.create({
            team_id: record.team_id,
            user_email: userEmail,
            full_name: displayName,
            role: playerRole,
            status: 'active',
            balance: 0,
            payment_status: 'paid',
          });
          console.log(`[acceptPendingInvites] Created Player profile for ${userEmail} in team ${record.team_id}`);
        } else {
          console.log(`[acceptPendingInvites] Player profile already exists for ${userEmail} in team ${record.team_id}`);
        }
      } catch (e) {
        console.warn(`[acceptPendingInvites] Player profile creation failed for team ${record.team_id}: ${e.message}`);
      }
    }

    return Response.json({ activated, records: invitedRecords });
  } catch (error) {
    console.error('[acceptPendingInvites] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});