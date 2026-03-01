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

    // Fetch team and join code
    const teams = await base44.entities.Team.filter({ id: team_id }).catch(() => []);
    const team = Array.isArray(teams) ? teams[0] : teams;
    if (!team) return Response.json({ error: 'Team not found' }, { status: 404 });

    // Build invite link with join code if available
    const joinCodeParam = team.join_code ? `?code=${team.join_code}` : '';
    const inviteLink = `https://idrettsøkonomi.no/Onboarding${joinCodeParam}`;

    const roleLabels = {
      admin: 'Admin',
      kasserer: 'Kasserer',
      styreleder: 'Styreleder',
      revisor: 'Revisor',
      forelder: 'Forelder',
      player: 'Spiller',
    };

    const subject = `Du er invitert til ${team_name}`;
    const body = `
Hei,

${user.full_name || user.email} har invitert deg til å bli med i "${team_name}" som ${roleLabels[role] || role}.

Dine oppgaver:
${getPermissions(role)}

For å komme i gang, klikk her: ${inviteLink}

Med vennlig hilsen,
IdrettsØkonomi-teamet
    `.trim();

    // Send invitation email via Core integration
    await base44.integrations.Core.SendEmail({
      to: recipient_email,
      subject: subject,
      body: body,
      from_name: 'IdrettsØkonomi',
    });

    return Response.json({ success: true, email_sent: true });
  } catch (error) {
    console.error('sendTeamInvitation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function getPermissions(role) {
  const perms = {
    admin: '• Full tilgang til alle funksjoner\n• Administrer medlemmer og roller\n• Opprett og rediger transaksjoner',
    kasserer: '• Håndter økonomi og transaksjoner\n• Opprett fakturaer og krav\n• Se økonomiske rapporter',
    styreleder: '• Oversikt over økonomien\n• Godkjenn krav og transaksjoner\n• Se rapporter',
    revisor: '• Lesing av transaksjoner og budsjett\n• Eksporter rapporter\n• Se revisjonslogg',
    forelder: '• Se dine betalinger\n• Betale krav\n• Oppdatere din profil',
    player: '• Se dine betalinger\n• Betale krav\n• Oppdatere din profil',
  };
  return perms[role] || '• Standardtilgang';
}