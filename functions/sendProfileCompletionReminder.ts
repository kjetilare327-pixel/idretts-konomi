import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all active teams
    const teams = await base44.asServiceRole.entities.Team.list();
    
    for (const team of teams) {
      // Find players with incomplete profiles created 3+ days ago
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const players = await base44.asServiceRole.entities.Player.filter({
        team_id: team.id,
        status: 'active'
      });
      
      for (const player of players) {
        const createdDate = new Date(player.created_date);
        
        // Check if player was created 3+ days ago and has incomplete profile
        if (createdDate <= threeDaysAgo && (!player.phone || !player.notes)) {
          // Check if we already sent a reminder
          const existingReminders = await base44.asServiceRole.entities.SentMessage.filter({
            team_id: team.id,
            recipient_email: player.user_email,
            subject: 'Fullfør din profil'
          });
          
          if (existingReminders.length === 0) {
            const emailBody = `Hei ${player.full_name},

Vi ser at din profil på ${team.name} fortsatt er ufullstendig. 

For å gi deg best mulig service, ber vi deg om å:
• Legge til telefonnummer
• Legge til eventuelle notater eller preferanser

Du kan oppdatere profilen din ved å logge inn på plattformen.

Vennlig hilsen,
${team.name}`;
            
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: player.user_email,
              subject: 'Fullfør din profil',
              body: emailBody.replace(/\n/g, '<br>')
            });
            
            await base44.asServiceRole.entities.SentMessage.create({
              team_id: team.id,
              recipient_email: player.user_email,
              recipient_name: player.full_name,
              subject: 'Fullfør din profil',
              body: emailBody,
              status: 'sent',
              sent_at: new Date().toISOString(),
              segment: 'incomplete_profile'
            });
          }
        }
      }
    }
    
    return Response.json({ 
      success: true,
      message: 'Profile completion reminders sent'
    });
    
  } catch (error) {
    console.error('Profile reminder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});