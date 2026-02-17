import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { team_id } = await req.json();
    
    if (!team_id) {
      return Response.json({ error: 'team_id is required' }, { status: 400 });
    }

    // Hent data
    const [players, claims, transactions] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ team_id, status: 'active' }),
      base44.asServiceRole.entities.Claim.filter({ team_id }),
      base44.asServiceRole.entities.Transaction.filter({ team_id })
    ]);

    // Analyser medlemsaktivitet og betalingsmønstre
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last3Months = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const playerAnalysis = players.map(player => {
      const playerClaims = claims.filter(c => c.player_id === player.id);
      const unpaidClaims = playerClaims.filter(c => c.status === 'pending' || c.status === 'overdue');
      const overdueClaims = playerClaims.filter(c => c.status === 'overdue');
      
      // Betalingshistorikk
      const recentPaid = playerClaims.filter(c => 
        c.status === 'paid' && new Date(c.updated_date) >= last3Months
      ).length;
      
      const totalUnpaid = unpaidClaims.reduce((sum, c) => sum + c.amount, 0);
      
      // Gjennomsnittlig betalingstid
      const paidClaims = playerClaims.filter(c => c.status === 'paid');
      let avgPaymentDays = 0;
      if (paidClaims.length > 0) {
        const totalDays = paidClaims.reduce((sum, c) => {
          const created = new Date(c.created_date);
          const updated = new Date(c.updated_date);
          const days = Math.ceil((updated - created) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0);
        avgPaymentDays = Math.round(totalDays / paidClaims.length);
      }

      return {
        player_id: player.id,
        full_name: player.full_name,
        email: player.user_email,
        role: player.role,
        balance: player.balance,
        payment_status: player.payment_status,
        total_unpaid: totalUnpaid,
        unpaid_count: unpaidClaims.length,
        overdue_count: overdueClaims.length,
        recent_paid: recentPaid,
        avg_payment_days: avgPaymentDays
      };
    });

    // Segment spillere
    const highRisk = playerAnalysis.filter(p => p.overdue_count > 0 || p.total_unpaid > 5000);
    const mediumRisk = playerAnalysis.filter(p => p.unpaid_count > 0 && !highRisk.includes(p));
    const goodStanding = playerAnalysis.filter(p => p.payment_status === 'paid' && p.balance <= 0);
    const slowPayers = playerAnalysis.filter(p => p.avg_payment_days > 30);

    // Prompt til AI
    const prompt = `Du er en kommunikasjonsekspert for norske idrettslag. Basert på medlemsaktivitet og betalingshistorikk, foreslå personlige kommunikasjonsstrategier.

MEDLEMSANALYSE:
Total medlemmer: ${players.length}
Høy risiko (forfalt/høy gjeld): ${highRisk.length}
Middels risiko (ubetalt): ${mediumRisk.length}
God status (betalt): ${goodStanding.length}
Trege betalere (>30 dager): ${slowPayers.length}

DETALJER:
- Gjennomsnittlig ubetalt beløp: ${(playerAnalysis.reduce((s, p) => s + p.total_unpaid, 0) / players.length).toFixed(0)} kr
- Totalt utestående: ${playerAnalysis.reduce((s, p) => s + p.total_unpaid, 0).toLocaleString('nb-NO')} kr

OPPGAVE:
Foreslå 3-5 kommunikasjonsstrategier for å:
1. Øke engasjement hos medlemmer i god status
2. Sikre rettidig betaling fra middels/høy risiko-grupper
3. Forbedre betalingshastighet hos trege betalere

For hver strategi, angi:
- Målgruppe (segment)
- Anbefalt kommunikasjonskanal (e-post/SMS)
- Optimal timing (dag/tidspunkt)
- Foreslått meldingsinnhold/tone
- Forventet effekt

Vær konkret og kulturelt tilpasset norske idrettslag.`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          strategies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                target_segment: { 
                  type: 'string',
                  enum: ['high_risk', 'medium_risk', 'good_standing', 'slow_payers', 'all']
                },
                channel: {
                  type: 'string',
                  enum: ['email', 'sms', 'both']
                },
                optimal_timing: { type: 'string' },
                message_tone: { type: 'string' },
                suggested_content: { type: 'string' },
                expected_impact: { type: 'string' }
              }
            }
          },
          summary: { type: 'string' }
        }
      }
    });

    return Response.json({
      success: true,
      strategies: aiResponse.strategies,
      summary: aiResponse.summary,
      segments: {
        high_risk: highRisk.length,
        medium_risk: mediumRisk.length,
        good_standing: goodStanding.length,
        slow_payers: slowPayers.length
      },
      member_details: playerAnalysis
    });

  } catch (error) {
    console.error('Error suggesting communication strategy:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});