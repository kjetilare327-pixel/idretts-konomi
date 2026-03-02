import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const teams = await base44.asServiceRole.entities.Team.list('-created_date', 100);
    console.log('Teams found:', JSON.stringify(teams));
    return Response.json({ teams, count: teams.length });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});