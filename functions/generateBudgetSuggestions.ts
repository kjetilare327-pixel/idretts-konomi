import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { team_id } = await req.json();
    if (!team_id) {
      return Response.json({ error: 'team_id required' }, { status: 400 });
    }

    // Fetch historical data
    const transactions = await base44.asServiceRole.entities.Transaction.filter({
      team_id,
      status: 'active'
    });

    // Calculate historical averages per category (last 12 months)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const recentTransactions = transactions.filter(t => 
      new Date(t.date) >= oneYearAgo
    );

    const categoryData = {};
    recentTransactions.forEach(t => {
      if (!categoryData[t.category]) {
        categoryData[t.category] = { type: t.type, total: 0, count: 0 };
      }
      categoryData[t.category].total += t.amount;
      categoryData[t.category].count += 1;
    });

    // Calculate monthly averages
    const suggestions = Object.keys(categoryData).map(category => {
      const data = categoryData[category];
      const monthlyAverage = data.total / 12;
      const adjustedAmount = Math.round(monthlyAverage * 1.05); // 5% buffer

      return {
        category,
        type: data.type,
        monthly_amount: adjustedAmount,
        yearly_amount: adjustedAmount * 12,
        historical_average: Math.round(monthlyAverage),
        transaction_count: data.count,
        confidence: data.count > 6 ? 'high' : data.count > 3 ? 'medium' : 'low'
      };
    });

    // Use AI to enhance suggestions
    const aiPrompt = `Basert på følgende historiske finansdata for et idrettslag, gi forslag til budsjettjusteringer og nye budsjettområder:

Kategorier med data:
${suggestions.map(s => `- ${s.category} (${s.type}): Gjennomsnitt ${s.historical_average} NOK/mnd, ${s.transaction_count} transaksjoner`).join('\n')}

Gi konkrete anbefalinger for:
1. Kategorier som bør økes/reduseres
2. Nye kategorier som bør legges til
3. Potensielle innsparingsområder

Returner som JSON med format:
{
  "adjustments": [{"category": "navn", "recommendation": "beskrivelse", "suggested_amount": tall}],
  "new_categories": [{"category": "navn", "type": "income/expense", "suggested_amount": tall, "reason": "årsak"}],
  "savings_opportunities": [{"area": "område", "potential_savings": tall, "action": "handling"}]
}`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          adjustments: { type: 'array' },
          new_categories: { type: 'array' },
          savings_opportunities: { type: 'array' }
        }
      }
    });

    return Response.json({
      success: true,
      budget_suggestions: suggestions,
      ai_recommendations: aiResponse,
      period_analyzed: '12 months',
      total_categories: suggestions.length
    });

  } catch (error) {
    console.error('Budget generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});