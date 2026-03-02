import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
// Debug: lists teams and shows join_codes

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
    
    return Response.json({ 
      userScoped: teamsUser.length, 
      serviceRole: teamsSR.length, 
      userTeams: teamsUser.map(t => ({ id: t.id, name: t.name, join_code: t.join_code })),
      srTeams: teamsSR.map(t => ({ id: t.id, name: t.name, join_code: t.join_code })),
    });
  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});