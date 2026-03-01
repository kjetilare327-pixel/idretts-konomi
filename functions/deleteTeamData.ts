import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TEAM_ENTITIES = [
  'Transaction', 'Budget', 'Player', 'Category', 'Claim', 'Payment',
  'Event', 'EventAttendance', 'TeamMember', 'MassCommunication',
  'MemberSegment', 'SentMessage', 'AuditLog', 'Notification',
  'BankTransaction', 'BankMatchingRule', 'CommunicationTemplate',
  'InvoiceSchedule', 'RoleDefinition',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { team_id } = await req.json();
    if (!team_id) return Response.json({ error: 'team_id required' }, { status: 400 });

    // Verify the user is an admin of this team
    const team = await base44.entities.Team.filter({ id: team_id }).catch(() => []);
    const teamObj = Array.isArray(team) ? team[0] : team;
    if (!teamObj) return Response.json({ error: 'Team not found' }, { status: 404 });

    const isCreator = teamObj.created_by === user.email;
    const isAdminMember = teamObj.members?.some(m => m.email === user.email && m.role === 'admin');
    const memberRecord = await base44.entities.TeamMember.filter({ team_id, user_email: user.email }).catch(() => []);
    const isTeamMemberAdmin = memberRecord?.[0]?.role === 'admin';

    if (!isCreator && !isAdminMember && !isTeamMemberAdmin) {
      return Response.json({ error: 'Forbidden: only team admins can delete team data' }, { status: 403 });
    }

    const results = {};

    // Delete all related entities
    for (const entityName of TEAM_ENTITIES) {
      try {
        const records = await base44.asServiceRole.entities[entityName].filter({ team_id }).catch(() => []);
        let deleted = 0;
        for (const record of records) {
          await base44.asServiceRole.entities[entityName].delete(record.id).catch(() => {});
          deleted++;
        }
        results[entityName] = deleted;
      } catch (e) {
        results[entityName] = `error: ${e.message}`;
      }
    }

    // Finally delete the team itself
    await base44.asServiceRole.entities.Team.delete(team_id);

    return Response.json({ success: true, deleted: results });
  } catch (error) {
    console.error('deleteTeamData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});