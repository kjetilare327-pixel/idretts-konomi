import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.in_app_role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { team_id } = await req.json();
    if (!team_id) {
      return Response.json({ error: 'team_id required' }, { status: 400 });
    }

    const results = {
      membership_invoices: 0,
      event_invoices: 0,
      volunteer_penalties: 0,
      total_amount: 0,
      errors: []
    };

    // Get active players
    const players = await base44.asServiceRole.entities.Player.filter({ 
      team_id, 
      status: 'active' 
    });

    // Get invoice schedules
    const schedules = await base44.asServiceRole.entities.InvoiceSchedule.filter({
      team_id,
      is_active: true
    });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (const schedule of schedules) {
      // Check if invoice should be generated today
      if (new Date(schedule.next_invoice_date) > today) continue;

      // Determine target players
      let targetPlayers = [];
      if (schedule.target_players === 'all') {
        targetPlayers = players;
      } else if (schedule.target_players === 'players') {
        targetPlayers = players.filter(p => p.role === 'player');
      } else if (schedule.target_players === 'parents') {
        targetPlayers = players.filter(p => p.role === 'parent');
      } else if (schedule.target_players === 'specific' && schedule.specific_player_ids) {
        targetPlayers = players.filter(p => schedule.specific_player_ids.includes(p.id));
      }

      // Create claims for each target player
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + (schedule.due_days_after || 14));

      for (const player of targetPlayers) {
        try {
          // Check if claim already exists for this period
          const existingClaim = await base44.asServiceRole.entities.Claim.filter({
            team_id,
            player_id: player.id,
            type: schedule.type,
            due_date: dueDate.toISOString().split('T')[0]
          });

          if (existingClaim.length > 0) continue; // Skip if already created

          // Create claim
          await base44.asServiceRole.entities.Claim.create({
            team_id,
            player_id: player.id,
            amount: schedule.amount,
            type: schedule.type,
            description: schedule.description,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending'
          });

          // Update player balance
          await base44.asServiceRole.entities.Player.update(player.id, {
            balance: (player.balance || 0) + schedule.amount
          });

          results.total_amount += schedule.amount;

          if (schedule.type === 'kontingent') {
            results.membership_invoices++;
          } else {
            results.event_invoices++;
          }

          // Send email notification
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: player.user_email,
              subject: `Nytt betalingskrav: ${schedule.description}`,
              body: `
                Hei ${player.full_name},

                Du har mottatt et nytt betalingskrav:

                Beskrivelse: ${schedule.description}
                Beløp: ${schedule.amount} NOK
                Forfallsdato: ${dueDate.toLocaleDateString('nb-NO')}

                Vennligst betal innen forfallsdato.

                Med vennlig hilsen,
                ${team_id}
              `
            });
          } catch (emailError) {
            console.error('Failed to send email:', emailError);
          }

        } catch (error) {
          results.errors.push({
            player: player.full_name,
            error: error.message
          });
        }
      }

      // Update next invoice date based on recurrence
      const nextDate = new Date(schedule.next_invoice_date);
      switch (schedule.recurrence) {
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
        case 'once':
          // Deactivate one-time schedules
          await base44.asServiceRole.entities.InvoiceSchedule.update(schedule.id, {
            is_active: false
          });
          continue;
      }

      await base44.asServiceRole.entities.InvoiceSchedule.update(schedule.id, {
        next_invoice_date: nextDate.toISOString().split('T')[0],
        last_generated: new Date().toISOString()
      });
    }

    // Check for volunteer duty penalties
    const volunteerAssignments = await base44.asServiceRole.entities.VolunteerAssignment.filter({
      team_id,
      status: 'signed_up'
    });

    const tasks = await base44.asServiceRole.entities.VolunteerTask.filter({
      team_id,
      status: 'completed'
    });

    for (const task of tasks) {
      const taskAssignments = volunteerAssignments.filter(a => a.task_id === task.id);
      const taskDate = new Date(task.date);
      const daysSince = Math.floor((today - taskDate) / (1000 * 60 * 60 * 24));

      // If task was more than 3 days ago and someone didn't show up
      if (daysSince > 3) {
        for (const assignment of taskAssignments) {
          if (assignment.status === 'signed_up') {
            const player = players.find(p => p.id === assignment.player_id);
            if (!player) continue;

            // Check if penalty already exists
            const existingPenalty = await base44.asServiceRole.entities.Claim.filter({
              team_id,
              player_id: player.id,
              type: 'dugnad',
              description: `Bot for ikke møtt på dugnad: ${task.title}`
            });

            if (existingPenalty.length > 0) continue;

            const penaltyAmount = 500; // NOK

            // Create penalty claim
            await base44.asServiceRole.entities.Claim.create({
              team_id,
              player_id: player.id,
              amount: penaltyAmount,
              type: 'dugnad',
              description: `Bot for ikke møtt på dugnad: ${task.title}`,
              due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              status: 'pending'
            });

            // Update player balance
            await base44.asServiceRole.entities.Player.update(player.id, {
              balance: (player.balance || 0) + penaltyAmount
            });

            results.volunteer_penalties++;
            results.total_amount += penaltyAmount;

            // Mark assignment as no_show
            await base44.asServiceRole.entities.VolunteerAssignment.update(assignment.id, {
              status: 'no_show'
            });
          }
        }
      }
    }

    return Response.json({
      success: true,
      ...results,
      message: `Generated ${results.membership_invoices + results.event_invoices + results.volunteer_penalties} invoices totaling ${results.total_amount} NOK`
    });

  } catch (error) {
    console.error('Invoicing automation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});