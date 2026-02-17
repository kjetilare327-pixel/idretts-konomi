import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { team_id } = await req.json();

    if (!team_id) {
      return Response.json({ error: 'team_id required' }, { status: 400 });
    }

    const notifications = [];
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    // Get all data
    const [players, events, claims, transactions, attendance] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ team_id, status: 'active' }),
      base44.asServiceRole.entities.Event.filter({ team_id }),
      base44.asServiceRole.entities.Claim.filter({ team_id }),
      base44.asServiceRole.entities.Transaction.filter({ team_id }),
      base44.asServiceRole.entities.EventAttendance.filter({ team_id })
    ]);

    // 1. Event reminders for upcoming events
    const upcomingEvents = events.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= now && eventDate <= twoDaysFromNow && e.status === 'scheduled';
    });

    for (const event of upcomingEvents) {
      // Find players who haven't RSVP'd
      const eventAttendance = attendance.filter(a => a.event_id === event.id);
      const respondedPlayerIds = new Set(eventAttendance.map(a => a.player_id));
      
      const nonRespondedPlayers = players.filter(p => !respondedPlayerIds.has(p.id));

      for (const player of nonRespondedPlayers) {
        notifications.push({
          team_id,
          user_email: player.user_email,
          type: 'event_reminder',
          title: `Påminnelse: ${event.title}`,
          message: `Du har ikke svart på ${event.title} den ${new Date(event.date).toLocaleDateString('nb-NO')}. Vennligst bekreft om du deltar.`,
          action_url: `/EventManagement?event_id=${event.id}`,
          action_label: 'Svar på arrangement',
          priority: 'high'
        });
      }
    }

    // 2. Payment reminders for overdue claims
    const overdueClaims = claims.filter(c => {
      const dueDate = new Date(c.due_date);
      return c.status === 'pending' && dueDate < now;
    });

    for (const claim of overdueClaims) {
      const player = players.find(p => p.id === claim.player_id);
      if (player) {
        notifications.push({
          team_id,
          user_email: player.user_email,
          type: 'payment_due',
          title: 'Forfalt betaling',
          message: `Din betaling på ${claim.amount} kr for ${claim.type} er forfalt. Vennligst betal så snart som mulig.`,
          action_url: '/PaymentPortal',
          action_label: 'Gå til betalinger',
          priority: 'high'
        });
      }
    }

    // 3. Profile completion nudges
    for (const player of players) {
      const missingFields = [];
      if (!player.phone) missingFields.push('telefonnummer');
      if (!player.referral_code) missingFields.push('henvisningskode');

      if (missingFields.length > 0) {
        notifications.push({
          team_id,
          user_email: player.user_email,
          type: 'profile_incomplete',
          title: 'Fullfør profilen din',
          message: `Din profil mangler: ${missingFields.join(', ')}. Fullfør profilen for å få full tilgang til alle funksjoner.`,
          action_url: '/Players',
          action_label: 'Oppdater profil',
          priority: 'low'
        });
      }
    }

    // 4. AI-driven financial insights
    const recentTransactions = transactions.filter(t => {
      const txDate = new Date(t.date);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return txDate >= thirtyDaysAgo;
    });

    const expenses = recentTransactions.filter(t => t.type === 'expense');
    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
    const avgExpense = totalExpenses / expenses.length;

    // Detect unusual spending
    const highExpenses = expenses.filter(t => t.amount > avgExpense * 2);
    if (highExpenses.length > 0) {
      const adminEmails = players.filter(p => p.role === 'admin').map(p => p.user_email);
      for (const email of adminEmails) {
        notifications.push({
          team_id,
          user_email: email,
          type: 'ai_suggestion',
          title: 'Uvanlig høye utgifter oppdaget',
          message: `AI-analyse viser ${highExpenses.length} utgifter over gjennomsnittet siste måned. Gjennomgå disse transaksjonene.`,
          action_url: '/Transactions',
          action_label: 'Se transaksjoner',
          priority: 'medium'
        });
      }
    }

    // Create all notifications
    for (const notif of notifications) {
      await base44.asServiceRole.entities.Notification.create(notif);
    }

    return Response.json({ 
      success: true, 
      notifications_created: notifications.length,
      breakdown: {
        event_reminders: notifications.filter(n => n.type === 'event_reminder').length,
        payment_due: notifications.filter(n => n.type === 'payment_due').length,
        profile_incomplete: notifications.filter(n => n.type === 'profile_incomplete').length,
        ai_suggestions: notifications.filter(n => n.type === 'ai_suggestion').length
      }
    });

  } catch (error) {
    console.error('Generate AI notifications error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});