import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { automation_id, is_active } = await req.json();
    if (!automation_id || is_active === undefined) {
      return Response.json({ error: 'automation_id and is_active required' }, { status: 400 });
    }

    const result = await base44.asServiceRole.functions.invoke('_toggleAutomation', { automation_id, is_active });
    return Response.json({ success: true, result });
  } catch (error) {
    console.error('toggleAutomation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});