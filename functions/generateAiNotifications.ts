import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function generateNotificationsForTeam(base44, team_id) {
  const notifications = [];
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

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

  // 4. AI-driven financial insights (unusual spending)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentExpenses = transactions.filter(t => t.type === 'expense' && new Date(t.date) >= thirtyDaysAgo);
  const totalExpenses = recentExpenses.reduce((sum, t) => sum + t.amount, 0);
  const avgExpense = recentExpenses.length > 0 ? totalExpenses / recentExpenses.length : 0;

  const highExpenses = recentExpenses.filter(t => t.amount > avgExpense * 2);
  if (highExpenses.length > 0) {
    const adminPlayers = players.filter(p => p.role === 'admin');
    for (const admin of adminPlayers) {
      notifications.push({
        team_id,
        user_email: admin.user_email,
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

  return {
    notifications_created: notifications.length,
    breakdown: {
      event_reminders: notifications.filter(n => n.type === 'event_reminder').length,
      payment_due: notifications.filter(n => n.type === 'payment_due').length,
      profile_incomplete: notifications.filter(n => n.type === 'profile_incomplete').length,
      ai_suggestions: notifications.filter(n => n.type === 'ai_suggestion').length
    }
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let team_id = null;
    try {
      const body = await req.json();
      team_id = body?.team_id || null;
    } catch (_) {
      // No body — running as scheduled automation
    }

    const isScheduled = !team_id;

    if (!isScheduled) {
      // Manual invocation — require auth
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    if (isScheduled) {
      // Run for all teams inline (no re-invocation to avoid 403)
      const allTeams = await base44.asServiceRole.entities.Team.list();
      const results = [];
      for (const team of allTeams) {
        try {
          const result = await generateNotificationsForTeam(base44, team.id);
          results.push({ team_id: team.id, team_name: team.name, status: 'ok', ...result });
        } catch (err) {
          console.error(`Failed for team ${team.id}:`, err.message);
          results.push({ team_id: team.id, team_name: team.name, status: 'error', error: err.message });
        }
      }
      return Response.json({ success: true, scheduled_run: true, results });
    }

    // Single team
    const result = await generateNotificationsForTeam(base44, team_id);
    return Response.json({ success: true, ...result });

  } catch (error) {
    console.error('Generate AI notifications error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});