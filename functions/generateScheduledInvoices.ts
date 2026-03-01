import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled (automation) calls without user auth; reject non-admin manual calls
    const isAuthenticated = await base44.auth.isAuthenticated().catch(() => false);
    if (isAuthenticated) {
      const user = await base44.auth.me().catch(() => null);
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    }

    // Hent alle aktive fakturaplaner
    const schedules = await base44.asServiceRole.entities.InvoiceSchedule.filter({ is_active: true });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let generatedCount = 0;
    const results = [];

    for (const schedule of schedules) {
      const nextDate = new Date(schedule.next_invoice_date);
      nextDate.setHours(0, 0, 0, 0);
      
      // Sjekk om det er på tide å generere
      if (nextDate <= today) {
        try {
          // Hent målspillere
          let targetPlayers = [];
          const allPlayers = await base44.asServiceRole.entities.Player.filter({ 
            team_id: schedule.team_id, 
            status: 'active' 
          });
          
          if (schedule.target_players === 'all') {
            targetPlayers = allPlayers;
          } else if (schedule.target_players === 'players') {
            targetPlayers = allPlayers.filter(p => p.role === 'player');
          } else if (schedule.target_players === 'parents') {
            targetPlayers = allPlayers.filter(p => p.role === 'parent');
          } else if (schedule.target_players === 'specific' && schedule.specific_player_ids) {
            targetPlayers = allPlayers.filter(p => schedule.specific_player_ids.includes(p.id));
          }

          // Opprett krav for hver spiller
          const dueDate = new Date(today);
          dueDate.setDate(dueDate.getDate() + (schedule.due_days_after || 14));
          
          for (const player of targetPlayers) {
            await base44.asServiceRole.entities.Claim.create({
              team_id: schedule.team_id,
              player_id: player.id,
              amount: schedule.amount,
              type: schedule.type,
              description: schedule.description,
              due_date: dueDate.toISOString().split('T')[0],
              status: 'pending'
            });
            
            // Oppdater spillersaldo
            await base44.asServiceRole.entities.Player.update(player.id, {
              balance: (player.balance || 0) + schedule.amount,
              payment_status: 'unpaid'
            });
          }

          generatedCount += targetPlayers.length;
          
          // Beregn neste fakturadato
          let nextInvoiceDate = new Date(schedule.next_invoice_date);
          if (schedule.recurrence === 'monthly') {
            nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);
          } else if (schedule.recurrence === 'quarterly') {
            nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 3);
          } else if (schedule.recurrence === 'yearly') {
            nextInvoiceDate.setFullYear(nextInvoiceDate.getFullYear() + 1);
          } else {
            // once - deaktiver etter generering
            await base44.asServiceRole.entities.InvoiceSchedule.update(schedule.id, {
              is_active: false,
              last_generated: new Date().toISOString()
            });
            results.push({ schedule: schedule.name, generated: targetPlayers.length, status: 'completed_once' });
            continue;
          }
          
          // Oppdater schedule
          await base44.asServiceRole.entities.InvoiceSchedule.update(schedule.id, {
            next_invoice_date: nextInvoiceDate.toISOString().split('T')[0],
            last_generated: new Date().toISOString()
          });
          
          results.push({ schedule: schedule.name, generated: targetPlayers.length, status: 'success' });
        } catch (error) {
          console.error(`Error generating for schedule ${schedule.id}:`, error);
          results.push({ schedule: schedule.name, error: error.message, status: 'error' });
        }
      }
    }

    return Response.json({
      success: true,
      generated_count: generatedCount,
      results
    });

  } catch (error) {
    console.error('Error generating scheduled invoices:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});