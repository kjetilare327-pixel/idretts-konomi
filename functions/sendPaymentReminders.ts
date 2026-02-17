import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Hent alle lag
    const teams = await base44.asServiceRole.entities.Team.list();
    let totalSent = 0;

    for (const team of teams) {
      // Hent forfalte krav
      const claims = await base44.asServiceRole.entities.Claim.filter({ 
        team_id: team.id,
        status: 'pending'
      });

      const overdueClaims = claims.filter(c => c.due_date < today);

      for (const claim of overdueClaims) {
        // Oppdater status til overdue
        await base44.asServiceRole.entities.Claim.update(claim.id, { 
          status: 'overdue',
          last_reminder_sent: new Date().toISOString()
        });

        // Hent spillerinfo
        const player = await base44.asServiceRole.entities.Player.get(claim.player_id);
        if (!player || !player.user_email) continue;

        const typeLabel = {
          kontingent: 'kontingent',
          cup: 'cupavgift',
          dugnad: 'dugnadsinnsats',
          utstyr: 'utstyr',
          annet: 'betaling'
        }[claim.type] || 'betaling';

        // Send e-post
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: team.name,
          to: player.user_email,
          subject: `Påminnelse: Ubetalt ${typeLabel}`,
          body: `
Hei ${player.full_name},

Du har en forfalt betaling hos ${team.name}:

• Type: ${typeLabel}
• Beløp: ${claim.amount} kr
• Forfallsdato: ${new Date(claim.due_date).toLocaleDateString('nb-NO')}
${claim.description ? `• Beskrivelse: ${claim.description}` : ''}
${claim.kid_reference ? `• KID-nummer: ${claim.kid_reference}` : ''}

Vennligst betal så snart som mulig.

Med vennlig hilsen,
${team.name}
          `.trim()
        });

        totalSent++;
      }
    }

    return Response.json({ 
      success: true, 
      reminders_sent: totalSent,
      message: `Sendt ${totalSent} påminnelser`
    });

  } catch (error) {
    console.error('Error sending reminders:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});