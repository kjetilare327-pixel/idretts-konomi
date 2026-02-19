import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    
    if (event.type !== 'create') {
      return Response.json({ success: true, message: 'Not a create event' });
    }

    const player = data;
    const team = await base44.asServiceRole.entities.Team.get(player.team_id);

    // 1. Send welcome email
    const welcomeEmailBody = `
<h2>Velkommen til ${team.name}! 🎉</h2>

<p>Hei ${player.full_name},</p>

<p>Vi er glade for å ha deg med i ${team.name}! Her er noen viktige steg for å komme i gang:</p>

<h3>📋 Fullfør profilen din</h3>
<ul>
  <li>Legg til telefonnummer for viktige varsler</li>
  <li>Bekreft kontaktinformasjon</li>
  <li>Sjekk dine betalingsopplysninger</li>
</ul>

<h3>📅 Se kommende arrangementer</h3>
<p>Logg inn for å se treninger, kamper og sosiale arrangementer.</p>

<h3>💰 Betalingsinformasjon</h3>
<p>Du vil snart motta informasjon om kontingent og andre avgifter. Alt kan betales enkelt via Vipps eller bankoverføring.</p>

<h3>🤝 Delta på dugnad</h3>
<p>Som medlem oppfordres du til å melde deg på dugnad når det passer. Sammen gjør vi laget bedre!</p>

<p>Ved spørsmål, ta kontakt med styret.</p>

<p>Hilsen<br>${team.name}</p>
    `;

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: player.user_email,
        subject: `Velkommen til ${team.name}!`,
        body: welcomeEmailBody
      });
    } catch (emailErr) {
      console.warn(`Could not send welcome email to ${player.user_email}:`, emailErr.message);
    }

    // 2. Create profile completion reminders
    const needsCompletion = [];
    if (!player.phone) needsCompletion.push('telefonnummer');
    if (!player.notes) needsCompletion.push('notater/ekstra info');

    if (needsCompletion.length > 0) {
      // Create a "task" as a claim with 0 amount just for tracking
      await base44.asServiceRole.entities.Claim.create({
        team_id: player.team_id,
        player_id: player.id,
        amount: 0,
        type: 'annet',
        description: `Profil ufullstendig: Mangler ${needsCompletion.join(', ')}`,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending'
      });
    }

    // 3. Log onboarding
    await base44.asServiceRole.entities.AuditLog.create({
      team_id: player.team_id,
      user_email: 'system@idrettsøkonomi.no',
      action: 'create',
      entity_type: 'Player',
      entity_id: player.id,
      description: `Ny medlem onboardet: ${player.full_name}`,
      timestamp: new Date().toISOString()
    });

    // 4. Send follow-up reminder after 3 days
    const followUpEmailBody = `
<h2>Hvordan går det? 👋</h2>

<p>Hei ${player.full_name},</p>

<p>Det har gått noen dager siden du ble medlem av ${team.name}. Vi håper du har funnet deg til rette!</p>

<h3>Husk å:</h3>
<ul>
  <li>✅ Fullfør profilen din hvis du ikke har gjort det</li>
  <li>✅ Meld deg på kommende arrangementer</li>
  <li>✅ Bli kjent med andre medlemmer</li>
</ul>

<p>Logg inn i medlemsportalen for å se alle funksjoner.</p>

<p>Hilsen<br>${team.name}</p>
    `;

    // Schedule follow-up (simulate with immediate send for demo)
    setTimeout(async () => {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: player.user_email,
          subject: `Påminnelse fra ${team.name}`,
          body: followUpEmailBody
        });
      } catch (emailErr) {
        console.warn(`Could not send follow-up email to ${player.user_email}:`, emailErr.message);
      }
    }, 1000);

    return Response.json({ 
      success: true,
      message: `Onboarding completed for ${player.full_name}`,
      actions_taken: [
        'Welcome email sent',
        needsCompletion.length > 0 ? 'Profile completion reminder created' : 'Profile complete',
        'Audit log created'
      ]
    });

  } catch (error) {
    console.error('Onboarding error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});