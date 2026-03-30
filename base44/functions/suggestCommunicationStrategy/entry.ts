import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { team_id } = await req.json();
    if (!team_id) return Response.json({ error: 'team_id is required' }, { status: 400 });

    // Require admin or kasserer
    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id, user_email: user.email.toLowerCase() });
      const allowedRoles = ['admin', 'kasserer', 'styreleder'];
      if (!membership.length || !allowedRoles.includes(membership[0].role)) {
        return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
      }
    }

    const [players, claims, transactions] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ team_id, status: 'active' }),
      base44.asServiceRole.entities.Claim.filter({ team_id }),
      base44.asServiceRole.entities.Transaction.filter({ team_id })
    ]);

    const now = new Date();
    const last3Months = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const playerAnalysis = players.map(player => {
      const playerClaims = claims.filter(c => c.player_id === player.id);
      const unpaidClaims = playerClaims.filter(c => c.status === 'pending' || c.status === 'overdue');
      const overdueClaims = playerClaims.filter(c => c.status === 'overdue');
      const totalUnpaid = unpaidClaims.reduce((sum, c) => sum + c.amount, 0);

      const paidClaims = playerClaims.filter(c => c.status === 'paid');
      let avgPaymentDays = 0;
      if (paidClaims.length > 0) {
        const totalDays = paidClaims.reduce((sum, c) => {
          const days = Math.ceil((new Date(c.updated_date) - new Date(c.created_date)) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0);
        avgPaymentDays = Math.round(totalDays / paidClaims.length);
      }

      return {
        player_id: player.id, full_name: player.full_name, email: player.user_email,
        role: player.role, balance: player.balance, payment_status: player.payment_status,
        total_unpaid: totalUnpaid, unpaid_count: unpaidClaims.length,
        overdue_count: overdueClaims.length, avg_payment_days: avgPaymentDays
      };
    });

    const highRisk = playerAnalysis.filter(p => p.overdue_count > 0 || p.total_unpaid > 5000);
    const mediumRisk = playerAnalysis.filter(p => p.unpaid_count > 0 && !highRisk.includes(p));
    const goodStanding = playerAnalysis.filter(p => p.payment_status === 'paid' && p.balance <= 0);
    const slowPayers = playerAnalysis.filter(p => p.avg_payment_days > 30);

    const prompt = `Du er en kommunikasjonsekspert for norske idrettslag. Basert på medlemsaktivitet og betalingshistorikk, foreslå personlige kommunikasjonsstrategier.

MEDLEMSANALYSE:
Total medlemmer: ${players.length}
Høy risiko (forfalt/høy gjeld): ${highRisk.length}
Middels risiko (ubetalt): ${mediumRisk.length}
God status (betalt): ${goodStanding.length}
Trege betalere (>30 dager): ${slowPayers.length}

Totalt utestående: ${playerAnalysis.reduce((s, p) => s + p.total_unpaid, 0).toLocaleString('nb-NO')} kr

Foreslå 3-5 kommunikasjonsstrategier på norsk.`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          strategies: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, target_segment: { type: 'string', enum: ['high_risk', 'medium_risk', 'good_standing', 'slow_payers', 'all'] }, channel: { type: 'string', enum: ['email', 'sms', 'both'] }, optimal_timing: { type: 'string' }, message_tone: { type: 'string' }, suggested_content: { type: 'string' }, expected_impact: { type: 'string' } } } },
          summary: { type: 'string' }
        }
      }
    });

    return Response.json({
      success: true, strategies: aiResponse.strategies, summary: aiResponse.summary,
      segments: { high_risk: highRisk.length, medium_risk: mediumRisk.length, good_standing: goodStanding.length, slow_payers: slowPayers.length },
      member_details: playerAnalysis
    });

  } catch (error) {
    console.error('Error suggesting communication strategy:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});