import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { team_id, title, message, segment_ids, notification_type } = await req.json();

    if (!team_id || !title || !message || !segment_ids || segment_ids.length === 0) {
      return Response.json({ error: 'Missing required fields: team_id, title, message, segment_ids' }, { status: 400 });
    }

    // Require admin or kasserer
    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id, user_email: user.email.toLowerCase() });
      const allowedRoles = ['admin', 'kasserer', 'styreleder'];
      if (!membership.length || !allowedRoles.includes(membership[0].role)) {
        return Response.json({ error: 'Forbidden: Krever admin, kasserer eller styreleder' }, { status: 403 });
      }
    }

    const [players, segments] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ team_id }),
      Promise.all(segment_ids.map(id => base44.asServiceRole.entities.MemberSegment.get(id)))
    ]);

    let targetPlayers = [];
    segments.forEach(segment => {
      if (!segment) return;
      const criteria = segment.criteria;
      const filtered = players.filter(p => {
        if (criteria.role && criteria.role !== 'all' && p.role !== criteria.role) return false;
        if (criteria.payment_status && criteria.payment_status.length > 0) {
          if (!criteria.payment_status.includes(p.payment_status)) return false;
        }
        if (criteria.balance_min !== undefined && (p.balance || 0) < criteria.balance_min) return false;
        if (criteria.balance_max !== undefined && (p.balance || 0) > criteria.balance_max) return false;
        if (criteria.has_overdue_claims && p.payment_status === 'paid') return false;
        return true;
      });
      targetPlayers.push(...filtered);
    });

    targetPlayers = [...new Map(targetPlayers.map(p => [p.id, p])).values()];

    const notifications = await Promise.all(
      targetPlayers.map(player =>
        base44.asServiceRole.entities.Notification.create({
          team_id, user_email: player.user_email, title, message,
          type: notification_type || 'ai_suggestion', priority: 'medium', read: false, action_url: null
        })
      )
    );

    return Response.json({ success: true, message: `Varsling sendt til ${notifications.length} medlemmer`, sent_count: notifications.length, target_count: targetPlayers.length });

  } catch (error) {
    console.error('sendMassNotifications error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});