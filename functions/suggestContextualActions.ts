import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { context, team_id } = await req.json();

    if (!context || !team_id) {
      return Response.json({ error: 'context and team_id required' }, { status: 400 });
    }

    const suggestions = [];

    // Context: composing a message
    if (context === 'composing_message') {
      const [templates, claims, events] = await Promise.all([
        base44.asServiceRole.entities.CommunicationTemplate.filter({ team_id, is_active: true }),
        base44.asServiceRole.entities.Claim.filter({ team_id, status: 'pending' }),
        base44.asServiceRole.entities.Event.filter({ team_id, status: 'scheduled' })
      ]);

      const upcomingEvents = events.filter(e => new Date(e.date) > new Date());
      const overdueClaims = claims.filter(c => new Date(c.due_date) < new Date());

      // Suggest templates based on current situation
      if (overdueClaims.length > 0) {
        const paymentTemplate = templates.find(t => t.type === 'payment_reminder');
        if (paymentTemplate) {
          suggestions.push({
            type: 'template',
            title: 'Bruk betalingspåminnelse-mal',
            description: `Du har ${overdueClaims.length} forfalte betalinger. Bruk denne malen for å sende påminnelser.`,
            action: 'use_template',
            data: paymentTemplate
          });
        }
      }

      if (upcomingEvents.length > 0) {
        const eventTemplate = templates.find(t => t.type === 'event_notification');
        if (eventTemplate) {
          suggestions.push({
            type: 'template',
            title: 'Varsle om kommende arrangement',
            description: `Du har ${upcomingEvents.length} kommende arrangementer. Informer medlemmene.`,
            action: 'use_template',
            data: eventTemplate
          });
        }
      }
    }

    // Context: viewing dashboard
    if (context === 'viewing_dashboard') {
      const [transactions, budgets, claims] = await Promise.all([
        base44.asServiceRole.entities.Transaction.filter({ team_id }),
        base44.asServiceRole.entities.Budget.filter({ team_id }),
        base44.asServiceRole.entities.Claim.filter({ team_id, status: 'overdue' })
      ]);

      const thisMonth = new Date().getMonth();
      const thisYear = new Date().getFullYear();
      
      const monthlyExpenses = transactions.filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense' && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      });

      const totalMonthlyExpenses = monthlyExpenses.reduce((s, t) => s + t.amount, 0);
      const totalBudget = budgets.filter(b => b.type === 'expense').reduce((s, b) => s + b.monthly_amount, 0);

      if (totalMonthlyExpenses > totalBudget * 0.8) {
        suggestions.push({
          type: 'warning',
          title: 'Utgifter nærmer seg budsjett',
          description: `Du har brukt ${((totalMonthlyExpenses / totalBudget) * 100).toFixed(0)}% av budsjettet denne måneden.`,
          action: 'view_budget',
          data: { url: '/Budget' }
        });
      }

      if (claims.length > 0) {
        suggestions.push({
          type: 'action',
          title: 'Send betalingspåminnelser',
          description: `${claims.length} betalinger er forfalt. Send påminnelser nå?`,
          action: 'send_reminders',
          data: { claim_count: claims.length }
        });
      }
    }

    // Context: viewing player profile
    if (context === 'viewing_player_profile') {
      const { player_id } = await req.json();
      
      const [player, playerClaims, playerTransactions] = await Promise.all([
        base44.asServiceRole.entities.Player.get(player_id),
        base44.asServiceRole.entities.Claim.filter({ player_id }),
        base44.asServiceRole.entities.Transaction.filter({ player_id })
      ]);

      if (player.balance > 0) {
        suggestions.push({
          type: 'action',
          title: 'Opprett betalingskrav',
          description: `Spilleren skylder ${player.balance} kr. Opprett et formelt krav?`,
          action: 'create_claim',
          data: { player_id, amount: player.balance }
        });
      }

      const unpaidClaims = playerClaims.filter(c => c.status === 'pending' || c.status === 'overdue');
      if (unpaidClaims.length > 0) {
        suggestions.push({
          type: 'action',
          title: 'Send betalingspåminnelse',
          description: `Spilleren har ${unpaidClaims.length} ubetalte krav. Send påminnelse?`,
          action: 'send_reminder',
          data: { player_id, claims: unpaidClaims }
        });
      }
    }

    return Response.json({ 
      success: true, 
      suggestions 
    });

  } catch (error) {
    console.error('Suggest contextual actions error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});