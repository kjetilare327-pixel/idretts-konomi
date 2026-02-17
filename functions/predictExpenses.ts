import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, months = 3 } = await req.json();

    // Hent historiske data
    const [transactions, budgets] = await Promise.all([
      base44.asServiceRole.entities.Transaction.filter({ team_id: teamId }),
      base44.asServiceRole.entities.Budget.filter({ team_id: teamId })
    ]);

    // Beregn historiske utgifter per kategori per måned
    const categoryStats = {};
    
    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      
      const month = new Date(tx.date).toISOString().slice(0, 7);
      if (!categoryStats[tx.category]) {
        categoryStats[tx.category] = { months: {}, total: 0, count: 0 };
      }
      
      if (!categoryStats[tx.category].months[month]) {
        categoryStats[tx.category].months[month] = 0;
      }
      
      categoryStats[tx.category].months[month] += tx.amount;
      categoryStats[tx.category].total += tx.amount;
      categoryStats[tx.category].count += 1;
    });

    // Bruk AI for å generere prognoser
    const categoriesWithData = Object.keys(categoryStats);
    
    const aiPrompt = `
Basert på følgende historiske utgiftsdata, generer prognoser for de neste ${months} månedene.

Historiske data per kategori:
${categoriesWithData.map(cat => {
  const stat = categoryStats[cat];
  const avgPerMonth = stat.total / Object.keys(stat.months).length;
  const monthlyValues = Object.values(stat.months);
  const trend = monthlyValues.length >= 2 
    ? monthlyValues[monthlyValues.length - 1] > monthlyValues[0] ? 'økende' : 'synkende'
    : 'stabil';
  
  return `- ${cat}: Gjennomsnitt ${Math.round(avgPerMonth)} kr/måned, Trend: ${trend}`;
}).join('\n')}

Budsjett per kategori (månedlig):
${budgets.map(b => `- ${b.category}: ${b.monthly_amount} kr`).join('\n')}

Returner prognoser i følgende JSON-format:
{
  "predictions": [
    {
      "month": "2026-03",
      "categories": {
        "Kategori1": {"predicted": 5000, "confidence": "high", "trend": "økende"},
        "Kategori2": {"predicted": 3000, "confidence": "medium", "trend": "stabil"}
      }
    }
  ],
  "budget_alerts": [
    {
      "category": "Kategori",
      "severity": "high",
      "message": "Forventet overskridelse med 20%",
      "recommendation": "Reduser utgifter eller øk budsjett"
    }
  ],
  "summary": {
    "total_predicted": 50000,
    "budget_variance": 5000,
    "high_risk_categories": ["Kategori1"]
  }
}

Ta hensyn til:
- Sesongvariasjoner
- Historiske trender
- Budsjettbegrensninger
- Identifiser potensielle budsjettoverskridelser
`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          predictions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                month: { type: "string" },
                categories: { type: "object" }
              }
            }
          },
          budget_alerts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                severity: { type: "string" },
                message: { type: "string" },
                recommendation: { type: "string" }
              }
            }
          },
          summary: {
            type: "object",
            properties: {
              total_predicted: { type: "number" },
              budget_variance: { type: "number" },
              high_risk_categories: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        }
      }
    });

    return Response.json({
      success: true,
      ...aiResponse
    });

  } catch (error) {
    console.error('Error predicting expenses:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});