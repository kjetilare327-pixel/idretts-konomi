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

    // Fetch team to get join_code - try multiple approaches, but don't fail if not found
    let joinCode = '';
    const userTeams = await base44.entities.Team.filter({ id: team_id }).catch(() => []);
    if (userTeams.length > 0) {
      joinCode = userTeams[0].join_code || '';
    } else {
      const allTeams = await base44.entities.Team.list('-created_date', 200).catch(() => []);
      const found = allTeams.find(t => t.id === team_id);
      if (found) joinCode = found.join_code || '';
    }
    // Also create a TeamMember record with 'invited' status so we can look up the role later
    await base44.asServiceRole.entities.TeamMember.create({
      team_id: team_id,
      user_email: recipient_email.toLowerCase(),
      role: role,
      status: 'invited',
      invited_by_email: user.email,
    }).catch(e => console.warn('[sendTeamInvitation] TeamMember pre-create warning:', e.message));

    const appUrl = 'https://app.base44.com/apps/68091f1e07f9b8d9b77d33a3';
    const inviteLink = joinCode
      ? `${appUrl}/Onboarding?code=${joinCode}&role=${role}`
      : `${appUrl}/Onboarding`;

    const roleLabels = {
      admin: 'Admin', kasserer: 'Kasserer', styreleder: 'Styreleder',
      revisor: 'Revisor', forelder: 'Forelder', player: 'Spiller',
    };
    const roleLabel = roleLabels[role] || role;

    const subject = `Du er invitert til ${team_name} på IdrettsØkonomi`;
    const body = `Hei!

${user.full_name || user.email} har invitert deg til å bli med i "${team_name}" som ${roleLabel}.

Klikk på lenken nedenfor for å opprette konto og bli med i laget automatisk:
${inviteLink}

Eller logg inn og skriv inn denne koden manuelt: ${joinCode}

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