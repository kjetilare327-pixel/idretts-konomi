import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Try with user context (no service role)
    const user = await base44.auth.me();
    console.log('User:', user?.email, 'role:', user?.role);
    
    const teamsUser = await base44.entities.Team.list('-created_date', 500);
    console.log('User-scoped list count:', teamsUser.length);
    
    const teamsSR = await base44.asServiceRole.entities.Team.list('-created_date', 500);
    console.log('Service role list count:', teamsSR.length);
    
    return Response.json({ userScoped: teamsUser.length, serviceRole: teamsSR.length, teams: teamsUser });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});