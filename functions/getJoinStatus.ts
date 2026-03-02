import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * getJoinStatus(teamId)
 *
 * Deterministic server-side check using SERVICE ROLE (no RLS).
 * Returns memberFound + teamFound so JoinActivationScreen can verify join succeeded.
 *
 * Called repeatedly by JoinActivationScreen with exponential backoff.
 */
Deno.serve(async (req) => {
  const requestId = Math.random().toString(36).slice(2, 10).toUpperCase();
  const ts = new Date().toISOString();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      console.warn(`[getJoinStatus] ${requestId} ${ts} — 401 UNAUTHORIZED`);
      return Response.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userEmail = user.email.toLowerCase();
    const body = await req.json();
    const { team_id } = body;

    if (!team_id) {
      return Response.json({ ok: false, code: 'MISSING_TEAM_ID' }, { status: 400 });
    }

    console.log(`[getJoinStatus] ${requestId} ${ts} — user=${userEmail} team_id=${team_id}`);

    // Step A: Check TeamMember via SERVICE ROLE — use list() to bypass filter quirks
    let memberRecord = null;
    let memberFound = false;
    try {
      // list() with large limit gets all records visible to service role
      const allMembers = await base44.asServiceRole.entities.TeamMember.list('-created_date', 500);
      console.log(`[getJoinStatus] ${requestId} stepA: total TeamMember rows visible=${allMembers.length}`);
      const userMembers = allMembers.filter(m => m.user_email === userEmail);
      console.log(`[getJoinStatus] ${requestId} stepA: rows for user=${userEmail} count=${userMembers.length} teamIds=${userMembers.map(m=>m.team_id).join(',')}`);
      memberRecord = userMembers.find(m => m.team_id === team_id && m.status === 'active') || null;
      memberFound = !!memberRecord;
      console.log(`[getJoinStatus] ${requestId} stepA: memberFound=${memberFound} recordId=${memberRecord?.id || 'none'}`);
    } catch (e) {
      console.error(`[getJoinStatus] ${requestId} stepA error: ${e.message}`);
    }

    // Step B: Fetch Team via SERVICE ROLE (bypasses RLS completely)
    let teamObj = null;
    let teamFound = false;
    try {
      const teams = await base44.asServiceRole.entities.Team.filter({ id: team_id });
      teamObj = teams[0] || null;
      teamFound = !!teamObj;
      console.log(`[getJoinStatus] ${requestId} stepB: teamFound=${teamFound} teamName=${teamObj?.name || 'none'}`);
    } catch (e) {
      console.error(`[getJoinStatus] ${requestId} stepB error: ${e.message}`);
    }

    console.log(`[getJoinStatus] ${requestId} RESULT: memberFound=${memberFound} teamFound=${teamFound} userId=${user.id || 'N/A'}`);

    return Response.json({
      ok: true,
      requestId,
      memberFound,
      teamFound,
      teamMemberId: memberRecord?.id || null,
      teamName: teamObj?.name || null,
      userId: user.id || null,
      userEmail,
    });

  } catch (error) {
    console.error(`[getJoinStatus] ${requestId} FATAL: ${error.message}`);
    return Response.json({ ok: false, code: 'UNKNOWN', message: error.message }, { status: 500 });
  }
});