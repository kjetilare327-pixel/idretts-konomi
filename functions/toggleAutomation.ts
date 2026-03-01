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

    // Use Base44 platform API to toggle the automation
    const appId = Deno.env.get('BASE44_APP_ID');
    const serviceToken = req.headers.get('Authorization');

    const response = await fetch(`https://api.base44.com/api/apps/${appId}/automations/${automation_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': serviceToken,
      },
      body: JSON.stringify({ is_active }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Automation toggle failed:', text);
      return Response.json({ error: 'Failed to toggle automation', details: text }, { status: 500 });
    }

    const data = await response.json();
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('toggleAutomation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});