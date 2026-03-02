import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Try list with higher limit
    const teamsA = await base44.asServiceRole.entities.Team.list('-created_date', 500);
    console.log('List result count:', teamsA.length);
    
    // Try filter with empty object
    const teamsB = await base44.asServiceRole.entities.Team.filter({}, '-created_date', 500);
    console.log('Filter result count:', teamsB.length);
    
    return Response.json({ listCount: teamsA.length, filterCount: teamsB.length, teams: teamsA });
  } catch (error) {
    console.error('Error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});