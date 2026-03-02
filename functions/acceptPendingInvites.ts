import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Called at boot time by AuthGate to auto-activate any 'invited' TeamMember records for the logged-in user.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userEmail = user.email.toLowerCase();

    // Use service role to find all invited records for this user
    const invitedRecords = await base44.asServiceRole.entities.TeamMember.filter({
      user_email: userEmail,
      status: 'invited',
    });

    console.log(`[acceptPendingInvites] Found ${invitedRecords.length} pending invite(s) for ${userEmail}`);

    if (invitedRecords.length === 0) {
      return Response.json({ activated: 0 });
    }

    // Activate all pending invites using service role
    let activated = 0;
    for (const record of invitedRecords) {
      await base44.asServiceRole.entities.TeamMember.update(record.id, { status: 'active' });
      console.log(`[acceptPendingInvites] Activated: team=${record.team_id} role=${record.role}`);
      activated++;
    }

    return Response.json({ activated, records: invitedRecords });
  } catch (error) {
    console.error('[acceptPendingInvites] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});