import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { team_id } = await req.json();
    if (!team_id) return Response.json({ error: 'team_id required' }, { status: 400 });

    // Require admin or kasserer
    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id, user_email: user.email.toLowerCase() });
      const allowedRoles = ['admin', 'kasserer', 'styreleder'];
      if (!membership.length || !allowedRoles.includes(membership[0].role)) {
        return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
      }
    }

    const transactions = await base44.asServiceRole.entities.Transaction.filter({ team_id, status: 'active' });

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recentTransactions = transactions.filter(t => new Date(t.date) >= oneYearAgo);

    const categoryData = {};
    recentTransactions.forEach(t => {
      if (!categoryData[t.category]) categoryData[t.category] = { type: t.type, total: 0, count: 0 };
      categoryData[t.category].total += t.amount;
      categoryData[t.category].count += 1;
    });

    const suggestions = Object.keys(categoryData).map(category => {
      const data = categoryData[category];
      const monthlyAverage = data.total / 12;
      const adjustedAmount = Math.round(monthlyAverage * 1.05);
      return {
        category, type: data.type, monthly_amount: adjustedAmount,
        yearly_amount: adjustedAmount * 12,
        historical_average: Math.round(monthlyAverage),
        transaction_count: data.count,
        confidence: data.count > 6 ? 'high' : data.count > 3 ? 'medium' : 'low'
      };
    });

    const aiPrompt = `Basert på følgende historiske finansdata for et idrettslag, gi forslag til budsjettjusteringer og nye budsjettområder:

Kategorier med data:
${suggestions.map(s => `- ${s.category} (${s.type}): Gjennomsnitt ${s.historical_average} NOK/mnd, ${s.transaction_count} transaksjoner`).join('\n')}

Gi konkrete anbefalinger som JSON:
{"adjustments": [{"category": "navn", "recommendation": "beskrivelse", "suggested_amount": tall}], "new_categories": [{"category": "navn", "type": "income/expense", "suggested_amount": tall, "reason": "årsak"}], "savings_opportunities": [{"area": "område", "potential_savings": tall, "action": "handling"}]}`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          adjustments: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, recommendation: { type: 'string' }, suggested_amount: { type: 'number' } } } },
          new_categories: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, type: { type: 'string' }, suggested_amount: { type: 'number' }, reason: { type: 'string' } } } },
          savings_opportunities: { type: 'array', items: { type: 'object', properties: { area: { type: 'string' }, potential_savings: { type: 'number' }, action: { type: 'string' } } } }
        }
      }
    });

    return Response.json({ success: true, budget_suggestions: suggestions, ai_recommendations: aiResponse, period_analyzed: '12 months', total_categories: suggestions.length });

  } catch (error) {
    console.error('Budget generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});