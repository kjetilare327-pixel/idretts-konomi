import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Single source of truth for app URL
const APP_BASE_URL = 'https://app.base44.com/apps/68091f1e07f9b8d9b77d33a3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { team_id, recipient_email, role, team_name } = await req.json();
    if (!team_id || !recipient_email || !role || !team_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Use service role to fetch team (guaranteed access)
    const teams = await base44.asServiceRole.entities.Team.filter({ id: team_id }).catch(() => []);
    const team = teams[0];
    const joinCode = team?.join_code || '';

    console.log(`[sendTeamInvitation] team_id=${team_id}, join_code=${joinCode}`);

    // Pre-create invited TeamMember so joinTeamByCode can activate it with correct role
    const existingMembers = await base44.asServiceRole.entities.TeamMember.filter({
      team_id: team_id,
      user_email: recipient_email.toLowerCase()
    }).catch(() => []);

    if (existingMembers.length === 0) {
      await base44.asServiceRole.entities.TeamMember.create({
        team_id: team_id,
        user_email: recipient_email.toLowerCase(),
        role: role,
        status: 'invited',
        invited_by_email: user.email,
      });
      console.log(`[sendTeamInvitation] Pre-created invited TeamMember for ${recipient_email} as ${role}`);
    }

    // Build invite link: goes to Onboarding with code+role pre-filled
    const inviteLink = `${APP_BASE_URL}/Onboarding?code=${joinCode}&role=${role}`;
    console.log(`[sendTeamInvitation] Generated invite link: ${inviteLink}`);

    const roleLabels = {
      admin: 'Admin', kasserer: 'Kasserer', styreleder: 'Styreleder',
      revisor: 'Revisor', forelder: 'Forelder', player: 'Spiller',
    };
    const roleLabel = roleLabels[role] || role;

    const subject = `Du er invitert til ${team_name} på IdrettsØkonomi`;
    const emailBody = `Hei!

${user.full_name || user.email} har invitert deg til å bli med i "${team_name}" som ${roleLabel}.

Klikk på lenken nedenfor for å bli med:
${inviteLink}

Eller logg inn på ${APP_BASE_URL} og skriv inn lagkoden manuelt: ${joinCode}

Med vennlig hilsen,
IdrettsØkonomi-teamet`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipient_email,
      subject: subject,
      body: emailBody,
      from_name: 'IdrettsØkonomi',
    });

    console.log(`[sendTeamInvitation] Email sent successfully to ${recipient_email}`);
    return Response.json({ success: true, email_sent: true });
  } catch (error) {
    console.error('[sendTeamInvitation] Error:', error.message, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});