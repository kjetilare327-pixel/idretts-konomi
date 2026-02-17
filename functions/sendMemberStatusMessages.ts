import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { team_id, message_type } = await req.json();

    if (!team_id || !message_type) {
      return Response.json({ error: 'Missing team_id or message_type' }, { status: 400 });
    }

    const [players, claims, events] = await Promise.all([
      base44.entities.Player.filter({ team_id }),
      base44.entities.Claim.filter({ team_id }),
      base44.entities.Event.filter({ team_id })
    ]);

    const now = new Date();
    const notifications = [];

    // Payment reminders for unpaid claims
    if (message_type === 'payment_reminders') {
      const overdueClaims = claims.filter(c => c.status === 'pending' || c.status === 'overdue');
      
      overdueClaims.forEach(claim => {
        const player = players.find(p => p.id === claim.player_id);
        if (player) {
          notifications.push({
            team_id,
            user_email: player.user_email,
            title: '💰 Purring: Utestående krav',
            message: `Hei ${player.full_name}! Du har et utestående krav på ${claim.amount} kr som forfaller ${new Date(claim.due_date).toLocaleDateString('nb-NO')}. Vennligst betalz.`,
            type: 'warning',
            priority: 'high',
            action_url: null
          });
        }
      });
    }

    // Birthday/anniversary greetings
    if (message_type === 'anniversaries') {
      players.forEach(player => {
        if (player.created_date) {
          const joined = new Date(player.created_date);
          const years = now.getFullYear() - joined.getFullYear();
          const isAnniversary = 
            joined.getMonth() === now.getMonth() && 
            joined.getDate() === now.getDate();

          if (isAnniversary && years > 0) {
            notifications.push({
              team_id,
              user_email: player.user_email,
              title: '🎉 Jubileum!',
              message: `Gratulerer ${player.full_name}! Du har vært medlem i ${years} år. Takk for ditt engasjement!`,
              type: 'success',
              priority: 'normal',
              action_url: null
            });
          }
        }
      });
    }

    // Event invitations
    if (message_type === 'event_invitations') {
      const upcomingEvents = events.filter(e => {
        const eventDate = new Date(e.date);
        const daysUntil = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
        return daysUntil > 0 && daysUntil <= 7 && (e.status === 'scheduled' || e.status === 'ongoing');
      });

      players.forEach(player => {
        upcomingEvents.forEach(event => {
          notifications.push({
            team_id,
            user_email: player.user_email,
            title: `📅 ${event.title}`,
            message: `Hei ${player.full_name}! Vi minner deg på at "${event.title}" finner sted ${new Date(event.date).toLocaleDateString('nb-NO')} kl. ${event.start_time}. Se detaljer i appen.`,
            type: 'info',
            priority: 'normal',
            action_url: null
          });
        });
      });
    }

    // High payment status members congratulations
    if (message_type === 'congratulations') {
      const consistent = players.filter(p => p.payment_status === 'paid' && p.status === 'active');
      
      consistent.forEach(player => {
        notifications.push({
          team_id,
          user_email: player.user_email,
          title: '✅ Takk for betaling!',
          message: `Takk ${player.full_name} for at du holder deg oppdatert med betalinger. Vi setter pris på ditt engasjement!`,
          type: 'success',
          priority: 'normal',
          action_url: null
        });
      });
    }

    // Create all notifications
    const created = await Promise.all(
      notifications.map(n => base44.entities.Notification.create(n))
    );

    return Response.json({
      success: true,
      message: `${created.length} meldinger sendt`,
      count: created.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});