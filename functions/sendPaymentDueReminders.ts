import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all active teams
    const teams = await base44.asServiceRole.entities.Team.list();
    
    for (const team of teams) {
      // Find claims that are due in the next 3 days and not paid
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      const claims = await base44.asServiceRole.entities.Claim.filter({
        team_id: team.id,
        status: 'pending'
      });
      
      for (const claim of claims) {
        const dueDate = new Date(claim.due_date);
        
        // Check if due within 3 days
        if (dueDate <= threeDaysFromNow && dueDate > new Date()) {
          // Check if reminder was sent in the last 2 days
          const twoDaysAgo = new Date();
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
          
          const player = await base44.asServiceRole.entities.Player.filter({
            id: claim.player_id
          });
          
          if (player.length === 0) continue;
          
          const recentReminders = await base44.asServiceRole.entities.SentMessage.filter({
            team_id: team.id,
            recipient_email: player[0].user_email,
            segment: 'payment_reminder'
          });
          
          const hasRecentReminder = recentReminders.some(msg => 
            new Date(msg.sent_at) > twoDaysAgo
          );
          
          if (!hasRecentReminder) {
            const daysUntilDue = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
            
            const emailBody = `Hei ${player[0].full_name},

Dette er en påminnelse om betaling som forfaller snart.

Type: ${claim.type}
Beløp: ${claim.amount} NOK
Forfallsdato: ${new Date(claim.due_date).toLocaleDateString('nb-NO')}
Dager til forfall: ${daysUntilDue}

${claim.vipps_payment_link ? `Betal enkelt med Vipps: ${claim.vipps_payment_link}` : ''}

Ved spørsmål, ta kontakt med ${team.name}.

Vennlig hilsen,
${team.name}`;
            
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: player[0].user_email,
              subject: `Påminnelse: Betaling forfaller om ${daysUntilDue} dag${daysUntilDue !== 1 ? 'er' : ''}`,
              body: emailBody.replace(/\n/g, '<br>')
            });
            
            await base44.asServiceRole.entities.SentMessage.create({
              team_id: team.id,
              recipient_email: player[0].user_email,
              recipient_name: player[0].full_name,
              subject: `Påminnelse: Betaling forfaller om ${daysUntilDue} dag${daysUntilDue !== 1 ? 'er' : ''}`,
              body: emailBody,
              status: 'sent',
              sent_at: new Date().toISOString(),
              segment: 'payment_reminder'
            });
            
            // Update last_reminder_sent on the claim
            await base44.asServiceRole.entities.Claim.update(claim.id, {
              last_reminder_sent: new Date().toISOString()
            });
          }
        }
      }
    }
    
    return Response.json({ 
      success: true,
      message: 'Payment reminders sent'
    });
    
  } catch (error) {
    console.error('Payment reminder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});