import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function logAudit(base44, teamId, userEmail, action, description) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      team_id: teamId,
      user_email: userEmail,
      action: 'create',
      entity_type: 'Team',
      entity_id: teamId,
      description,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[createNewTeam] AuditLog failed (non-blocking):', e.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, message: 'Ikke innlogget' }, { status: 401 });

    const body = await req.json();
    const { name, sport_type, estimated_members, nif_number } = body;

    if (!name || !sport_type) {
      return Response.json({ ok: false, message: 'Mangler lagsnavn eller idrettstype' }, { status: 400 });
    }

    const userEmail = user.email.toLowerCase();
    const joinCode = generateJoinCode();
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`[createNewTeam] Creating team "${name}" for ${userEmail} with join_code=${joinCode}`);

    const newTeam = await base44.asServiceRole.entities.Team.create({
      name,
      sport_type,
      estimated_members: Number(estimated_members) || 0,
      nif_number: nif_number || '',
      subscription_status: 'trial',
      trial_end_date: trialEnd,
      gdpr_consent: true,
      join_code: joinCode,
      members: [{ email: userEmail, role: 'admin' }],
    });

    console.log(`[createNewTeam] Team created: ${newTeam.id}`);

    await base44.asServiceRole.entities.TeamMember.create({
      team_id: newTeam.id,
      user_email: userEmail,
      role: 'admin',
      status: 'active',
      invited_by_email: userEmail,
    });

    console.log(`[createNewTeam] TeamMember (admin) created for ${userEmail}`);

    await logAudit(base44, newTeam.id, userEmail, 'create', `Lag opprettet: ${name}`);

    return Response.json({ ok: true, team_id: newTeam.id, team_name: newTeam.name, join_code: joinCode });
  } catch (error) {
    console.error('[createNewTeam] FATAL:', error.message, error.stack);
    return Response.json({ ok: false, message: 'Serverfeil: ' + error.message }, { status: 500 });
  }
});