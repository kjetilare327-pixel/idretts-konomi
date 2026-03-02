import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { team_id, recipient_email, role, team_name } = await req.json();
    if (!team_id || !recipient_email || !role || !team_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch team to get join_code - try multiple approaches
    let team = null;
    // Try user-scoped first (works if user is team member)
    const userTeams = await base44.entities.Team.filter({ id: team_id }).catch(() => []);
    if (userTeams.length > 0) team = userTeams[0];
    // Fallback: list all and find by id
    if (!team) {
      const allTeams = await base44.entities.Team.list('-created_date', 200).catch(() => []);
      team = allTeams.find(t => t.id === team_id);
    }
    if (!team) return Response.json({ error: 'Team not found' }, { status: 404 });

    const joinCode = team.join_code || '';
    const appUrl = 'https://idretts-okonomi-appen.com';
    const inviteLink = `${appUrl}/Onboarding?code=${joinCode}`;

    const roleLabels = {
      admin: 'Admin', kasserer: 'Kasserer', styreleder: 'Styreleder',
      revisor: 'Revisor', forelder: 'Forelder', player: 'Spiller',
    };
    const roleLabel = roleLabels[role] || role;

    const subject = `Du er invitert til ${team_name} på IdrettsØkonomi`;
    const body = `Hei!

${user.full_name || user.email} har invitert deg til å bli med i "${team_name}" som ${roleLabel}.

Klikk her for å bli med:
${inviteLink}

Eller gå til appen og skriv inn denne koden manuelt: ${joinCode}

Med vennlig hilsen,
IdrettsØkonomi-teamet`;

    console.log(`[sendTeamInvitation] Sending invite to ${recipient_email} for team ${team_name} (${team_id})`);

    // Use service role for sending email (required by Base44 integrations)
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipient_email,
      subject: subject,
      body: body,
      from_name: 'IdrettsØkonomi',
    });

    console.log(`[sendTeamInvitation] Email sent successfully to ${recipient_email}`);
    return Response.json({ success: true, email_sent: true });
  } catch (error) {
    console.error('[sendTeamInvitation] Error:', error.message, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});