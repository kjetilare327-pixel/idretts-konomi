import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { message_id, status, opened_at } = await req.json();
    if (!message_id || !status) return Response.json({ error: 'message_id and status required' }, { status: 400 });

    // Verify the message belongs to a team the user is admin/kasserer of
    const message = await base44.asServiceRole.entities.SentMessage.get(message_id);
    if (!message) return Response.json({ error: 'Message not found' }, { status: 404 });

    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id: message.team_id, user_email: user.email.toLowerCase() });
      const allowedRoles = ['admin', 'kasserer'];
      if (!membership.length || !allowedRoles.includes(membership[0].role)) {
        return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
      }
    }

    const updateData = { status };
    if (opened_at) updateData.opened_at = opened_at;

    await base44.asServiceRole.entities.SentMessage.update(message_id, updateData);

    return Response.json({ success: true, message: `Message status updated to ${status}` });

  } catch (error) {
    console.error('Message tracking error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});