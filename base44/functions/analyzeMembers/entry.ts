import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { team_id } = await req.json();
    if (!team_id) return Response.json({ error: 'team_id required' }, { status: 400 });

    // Admin-only: member analytics contains sensitive PII/financial data
    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id, user_email: user.email.toLowerCase() });
      if (!membership.length || membership[0].role !== 'admin') {
        return Response.json({ error: 'Forbidden: Krever admin-rolle' }, { status: 403 });
      }
    }

    const [players, events, attendance, claims, payments, volunteers] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ team_id, status: 'active' }),
      base44.asServiceRole.entities.Event.filter({ team_id }),
      base44.asServiceRole.entities.EventAttendance.filter({ team_id }),
      base44.asServiceRole.entities.Claim.filter({ team_id }),
      base44.asServiceRole.entities.Payment.filter({ team_id }),
      Promise.resolve([])
    ]);

    const playerMetrics = players.map(player => {
      const playerAttendance = attendance.filter(a => a.player_id === player.id);
      const playerClaims = claims.filter(c => c.player_id === player.id);
      const playerPayments = payments.filter(p => p.player_id === player.id);
      const playerVolunteer = volunteers.filter(v => v.player_id === player.id);

      const activeEvents = events.filter(e => e.status !== 'cancelled').length;
      const attendanceRate = activeEvents > 0 ? (playerAttendance.filter(a => a.attendance_status === 'present').length / activeEvents) * 100 : 0;
      const totalClaims = playerClaims.reduce((sum, c) => sum + c.amount, 0);
      const totalPaid = playerPayments.reduce((sum, p) => sum + p.amount, 0);
      const balance = player.balance || 0;
      const volunteerHours = playerVolunteer.reduce((sum, v) => sum + (v.hours_worked || 0), 0);

      return {
        name: player.full_name,
        email: player.user_email,
        attendanceRate: Math.round(attendanceRate),
        paymentStatus: player.payment_status,
        balance,
        totalClaims,
        totalPaid,
        unpaidAmount: totalClaims - totalPaid,
        volunteerHours,
        eventsAttended: playerAttendance.filter(a => a.attendance_status === 'present').length,
        registeredDate: player.created_date
      };
    });

    const analysisPrompt = `
Analyser disse medlemsdata fra et idrettslag og:
1. Identifiser dynamiske segmenter basert på mønstre
2. Forutsi medlemmer som står i fare for å falle fra
3. Foreslå målrettede tiltak for hver gruppe

Medlemsdata:
${JSON.stringify(playerMetrics, null, 2)}

Svar i JSON-format med denne strukturen:
{
  "segments": [
    {
      "name": "Segment navn",
      "description": "Beskrivelse",
      "criteria": "Hvilke medlemmer tilhører denne",
      "memberIds": ["email1", "email2"],
      "recommendations": ["Tiltak 1", "Tiltak 2"]
    }
  ],
  "atRiskMembers": [
    {
      "name": "Navn",
      "email": "email",
      "riskLevel": "high/medium/low",
      "riskFactors": ["Faktor 1", "Faktor 2"],
      "suggestedActions": ["Tiltak 1", "Tiltak 2"]
    }
  ],
  "insights": {
    "engagement": "Gjennomsnittlig engasjeringsgrad",
    "paymentTrends": "Observasjoner om betalingsmønstre",
    "churnRisk": "Estimert risiko for frafall"
  }
}`;

    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: analysisPrompt,
      add_context_from_internet: false,
      response_json_schema: {
        type: 'object',
        properties: {
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                criteria: { type: 'string' },
                memberIds: { type: 'array', items: { type: 'string' } },
                recommendations: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          atRiskMembers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                riskLevel: { type: 'string', enum: ['high', 'medium', 'low'] },
                riskFactors: { type: 'array', items: { type: 'string' } },
                suggestedActions: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          insights: {
            type: 'object',
            properties: {
              engagement: { type: 'string' },
              paymentTrends: { type: 'string' },
              churnRisk: { type: 'string' }
            }
          }
        }
      }
    });

    return Response.json(response);
  } catch (error) {
    console.error('analyzeMembers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});