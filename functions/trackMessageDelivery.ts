import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { message_id, status, opened_at } = await req.json();
    if (!message_id || !status) return Response.json({ error: 'message_id and status required' }, { status: 400 });

    const updateData = { status };
    if (opened_at) updateData.opened_at = opened_at;

    await base44.asServiceRole.entities.SentMessage.update(message_id, updateData);

    return Response.json({ success: true, message: `Message status updated to ${status}` });

  } catch (error) {
    console.error('Message tracking error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});