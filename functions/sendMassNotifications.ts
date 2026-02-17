import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { team_id, title, message, segment_ids, notification_type } = await req.json();

    if (!team_id || !title || !message || !segment_ids || segment_ids.length === 0) {
      return Response.json({ 
        error: 'Missing required fields: team_id, title, message, segment_ids' 
      }, { status: 400 });
    }

    // Verify user is admin
    const team = await base44.entities.Team.get(team_id);
    const isAdmin = team.members?.some(m => m.email === user.email && m.role === 'admin');

    if (!isAdmin) {
      return Response.json({ error: 'Only admins can send notifications' }, { status: 403 });
    }

    // Get players from selected segments
    const [players, segments] = await Promise.all([
      base44.entities.Player.filter({ team_id }),
      Promise.all(segment_ids.map(id => base44.entities.MemberSegment.get(id)))
    ]);

    let targetPlayers = [];

    segments.forEach(segment => {
      const criteria = segment.criteria;
      
      const filtered = players.filter(p => {
        // Match by role
        if (criteria.role && criteria.role !== 'all' && p.role !== criteria.role) return false;

        // Match by payment status
        if (criteria.payment_status && criteria.payment_status.length > 0) {
          if (!criteria.payment_status.includes(p.payment_status)) return false;
        }

        // Match by balance range
        if (criteria.balance_min !== undefined && (p.balance || 0) < criteria.balance_min) return false;
        if (criteria.balance_max !== undefined && (p.balance || 0) > criteria.balance_max) return false;

        // Match by overdue claims
        if (criteria.has_overdue_claims) {
          // In real scenario, would check against Claim entities
          // For now, assume if they're unpaid they might have overdue
          if (p.payment_status === 'paid') return false;
        }

        return true;
      });

      targetPlayers.push(...filtered);
    });

    // Remove duplicates
    targetPlayers = [...new Map(targetPlayers.map(p => [p.id, p])).values()];

    // Create notifications for each target player
    const notifications = await Promise.all(
      targetPlayers.map(player => 
        base44.entities.Notification.create({
          team_id,
          user_email: player.user_email,
          title,
          message,
          type: notification_type || 'info',
          priority: 'normal',
          read: false,
          action_url: null
        })
      )
    );

    return Response.json({
      success: true,
      message: `Varsling sendt til ${notifications.length} medlemmer`,
      sent_count: notifications.length,
      target_count: targetPlayers.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});