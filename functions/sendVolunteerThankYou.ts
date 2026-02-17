import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event } = await req.json();
    
    // This function is triggered by entity automation when VolunteerAssignment is updated
    if (event?.type !== 'update') {
      return Response.json({ message: 'Not an update event' });
    }
    
    const assignmentId = event.entity_id;
    const assignment = await base44.asServiceRole.entities.VolunteerAssignment.filter({ id: assignmentId });
    
    if (assignment.length === 0) {
      return Response.json({ error: 'Assignment not found' }, { status: 404 });
    }
    
    const currentAssignment = assignment[0];
    
    // Only send thank you if status changed to 'completed'
    if (currentAssignment.status === 'completed') {
      const player = await base44.asServiceRole.entities.Player.filter({ id: currentAssignment.player_id });
      const task = await base44.asServiceRole.entities.VolunteerTask.filter({ id: currentAssignment.task_id });
      const team = await base44.asServiceRole.entities.Team.filter({ id: currentAssignment.team_id });
      
      if (player.length === 0 || task.length === 0 || team.length === 0) {
        return Response.json({ error: 'Related entities not found' }, { status: 404 });
      }
      
      // Check if thank you was already sent
      const existingThankYou = await base44.asServiceRole.entities.SentMessage.filter({
        team_id: currentAssignment.team_id,
        recipient_email: player[0].user_email,
        segment: 'volunteer_thank_you'
      });
      
      const alreadySent = existingThankYou.some(msg => 
        msg.body.includes(task[0].title)
      );
      
      if (!alreadySent) {
        const hoursWorked = currentAssignment.hours_worked || task[0].hours_estimated || 0;
        
        const emailBody = `Hei ${player[0].full_name},

Tusen takk for din innsats med "${task[0].title}"!

Din dugnadsinnsats er uvurderlig for ${team[0].name}. ${hoursWorked > 0 ? `Du har bidratt med ${hoursWorked} timer, ` : ''}og det setter vi stor pris på.

Uten frivillige som deg ville ikke laget fungert. Takk for at du stiller opp!

Vennlig hilsen,
${team[0].name}`;
        
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: player[0].user_email,
          subject: `Takk for din dugnadsinnsats! 🎉`,
          body: emailBody.replace(/\n/g, '<br>')
        });
        
        await base44.asServiceRole.entities.SentMessage.create({
          team_id: currentAssignment.team_id,
          recipient_email: player[0].user_email,
          recipient_name: player[0].full_name,
          subject: 'Takk for din dugnadsinnsats! 🎉',
          body: emailBody,
          status: 'sent',
          sent_at: new Date().toISOString(),
          segment: 'volunteer_thank_you'
        });
      }
    }
    
    return Response.json({ 
      success: true,
      message: 'Thank you email processed'
    });
    
  } catch (error) {
    console.error('Volunteer thank you error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});