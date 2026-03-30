import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const APP_LOGIN_URL = 'https://idretts-okonomi-appen.com/login';

Deno.serve(async (req) => {
  const ts = new Date().toISOString();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { team_id, recipient_email, role, team_name } = await req.json();
    console.log(`[sendTeamInvitation] ${ts} START — to=${recipient_email} team=${team_id} role=${role}`);

    if (!team_id || !recipient_email || !role || !team_name) {
      return Response.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const recipientEmail = recipient_email.trim().toLowerCase();

    // Upsert pending invite via service role (avoids RLS)
    const existingRecords = await base44.asServiceRole.entities.TeamMember.filter({
      team_id,
      user_email: recipientEmail,
    }).catch(() => []);

    if (existingRecords.length === 0) {
      await base44.asServiceRole.entities.TeamMember.create({
        team_id,
        user_email: recipientEmail,
        role,
        status: 'invited',
        invited_by_email: user.email,
      });
      console.log(`[sendTeamInvitation] Created pending invite for ${recipientEmail} as ${role}`);
    } else {
      console.log(`[sendTeamInvitation] Invite record already exists for ${recipientEmail}`);
    }

    const roleLabels = {
      admin: 'Admin', kasserer: 'Kasserer', styreleder: 'Styreleder',
      revisor: 'Revisor', forelder: 'Forelder', player: 'Spiller',
    };
    const roleLabel = roleLabels[role] || role;

    const subject = `Du er invitert til ${team_name} på IdrettsØkonomi`;
    const emailBody = `Hei!

${user.full_name || user.email} har invitert deg til å bli med i "${team_name}" som ${roleLabel}.

Klikk på lenken nedenfor for å logge inn og bli automatisk lagt til i laget:
${APP_LOGIN_URL}

Etter at du logger inn vil du automatisk bli lagt til i "${team_name}" og sendt til dashbordet.

Med vennlig hilsen,
IdrettsØkonomi`;

    console.log(`[sendTeamInvitation] Sending email to ${recipientEmail} — link: ${APP_LOGIN_URL}`);

    const emailResult = await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipientEmail,
      subject,
      body: emailBody,
      from_name: 'IdrettsØkonomi',
    });

    console.log(`[sendTeamInvitation] Email sent OK to ${recipientEmail}. Result:`, JSON.stringify(emailResult));
    return Response.json({ ok: true, email_sent: true });

  } catch (error) {
    console.error(`[sendTeamInvitation] ${ts} ERROR:`, error.message, error.stack);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});