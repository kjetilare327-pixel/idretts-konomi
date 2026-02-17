import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { team_id, scenario = null } = await req.json();
    
    if (!team_id) {
      return Response.json({ error: 'team_id is required' }, { status: 400 });
    }

    // Fetch historical data
    const [transactions, budgets, claims, players, team] = await Promise.all([
      base44.asServiceRole.entities.Transaction.filter({ team_id }),
      base44.asServiceRole.entities.Budget.filter({ team_id }),
      base44.asServiceRole.entities.Claim.filter({ team_id }),
      base44.asServiceRole.entities.Player.filter({ team_id }),
      base44.asServiceRole.entities.Team.get(team_id)
    ]);

    // Analyze historical trends
    const now = new Date();
    const monthlyData = [];
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const monthTx = transactions.filter(t => t.date?.startsWith(monthStr));
      const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      
      monthlyData.push({
        month: monthStr,
        income,
        expense,
        net: income - expense
      });
    }

    // Calculate metrics
    const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0);
    const totalExpense = monthlyData.reduce((s, m) => s + m.expense, 0);
    const avgMonthlyIncome = totalIncome / 12;
    const avgMonthlyExpense = totalExpense / 12;
    const avgMonthlyNet = avgMonthlyIncome - avgMonthlyExpense;

    // Seasonal patterns
    const seasonalIncome = {};
    const seasonalExpense = {};
    monthlyData.forEach(m => {
      const month = parseInt(m.month.split('-')[1]);
      seasonalIncome[month] = (seasonalIncome[month] || []).concat(m.income);
      seasonalExpense[month] = (seasonalExpense[month] || []).concat(m.expense);
    });

    // Growth trends
    const recentMonths = monthlyData.slice(-6);
    const olderMonths = monthlyData.slice(0, 6);
    const recentAvgIncome = recentMonths.reduce((s, m) => s + m.income, 0) / 6;
    const olderAvgIncome = olderMonths.reduce((s, m) => s + m.income, 0) / 6;
    const incomeGrowthRate = olderAvgIncome > 0 ? ((recentAvgIncome - olderAvgIncome) / olderAvgIncome * 100) : 0;

    // Unpaid claims
    const unpaidClaims = claims.filter(c => c.status !== 'paid' && c.status !== 'cancelled');
    const totalUnpaid = unpaidClaims.reduce((s, c) => s + c.amount, 0);

    // Build context for AI
    const scenarioText = scenario ? `
WHAT-IF SCENARIO:
${JSON.stringify(scenario, null, 2)}

Analyser hvordan dette scenariet vil påvirke økonomien.
` : '';

    const prompt = `Du er en finansanalytiker for idrettslag. Analyser historiske data og lag prognoser.

LAG: ${team.name} (${team.sport_type})
MEDLEMMER: ${players.filter(p => p.status === 'active').length} aktive

HISTORISK DATA (siste 12 måneder):
${monthlyData.map(m => `${m.month}: Inntekt ${m.income.toLocaleString('nb-NO')} kr, Utgift ${m.expense.toLocaleString('nb-NO')} kr, Netto ${m.net.toLocaleString('nb-NO')} kr`).join('\n')}

NØKKELTALL:
- Gjennomsnittlig månedlig inntekt: ${avgMonthlyIncome.toLocaleString('nb-NO')} kr
- Gjennomsnittlig månedlig utgift: ${avgMonthlyExpense.toLocaleString('nb-NO')} kr
- Gjennomsnittlig månedlig netto: ${avgMonthlyNet.toLocaleString('nb-NO')} kr
- Inntektsvekst (siste 6 vs tidligere 6 mnd): ${incomeGrowthRate.toFixed(1)}%
- Ubetalt (krav): ${totalUnpaid.toLocaleString('nb-NO')} kr

BUDSJETT:
${budgets.length > 0 ? budgets.map(b => `- ${b.category} (${b.type}): ${b.monthly_amount.toLocaleString('nb-NO')} kr/mnd`).join('\n') : 'Ikke satt'}

${scenarioText}

OPPGAVE:
1. LAG PROGNOSER for neste 12 måneder (måned-for-måned prediksjoner)
2. IDENTIFISER potensielle underskudd eller overskudd
3. ANALYSER risikofaktorer og muligheter
4. GI ANBEFALINGER for økonomisk handling

Ta hensyn til:
- Historiske trender og vekst
- Sesongvariasjoner for ${team.sport_type}
- Norske idrettslags typiske inntekts-/utgiftsmønstre
- Realistiske prognoser basert på faktiske data

Format: konkrete tall, dato-baserte prognoser, handlingsbare anbefalinger.`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          monthly_forecast: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                month: { type: 'string' },
                predicted_income: { type: 'number' },
                predicted_expense: { type: 'number' },
                predicted_net: { type: 'number' },
                confidence: { type: 'number', description: '0-100%' },
                notes: { type: 'string' }
              }
            }
          },
          key_predictions: {
            type: 'object',
            properties: {
              best_month: { type: 'string' },
              worst_month: { type: 'string' },
              total_year_income: { type: 'number' },
              total_year_expense: { type: 'number' },
              expected_surplus_deficit: { type: 'number' }
            }
          },
          risks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                risk: { type: 'string' },
                probability: { type: 'string', enum: ['low', 'medium', 'high'] },
                impact: { type: 'number' },
                mitigation: { type: 'string' }
              }
            }
          },
          opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                opportunity: { type: 'string' },
                potential_value: { type: 'number' },
                effort: { type: 'string', enum: ['low', 'medium', 'high'] },
                timeline: { type: 'string' }
              }
            }
          },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string' },
                timing: { type: 'string' },
                expected_impact: { type: 'number' },
                priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }
              }
            }
          },
          scenario_impact: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              financial_change: { type: 'number' },
              feasibility: { type: 'string' }
            }
          },
          summary: { type: 'string' }
        }
      }
    });

    return Response.json({
      success: true,
      forecast: aiResponse,
      historical_data: {
        monthly: monthlyData,
        avg_monthly_income: avgMonthlyIncome,
        avg_monthly_expense: avgMonthlyExpense,
        income_growth_rate: incomeGrowthRate
      },
      analyzed_at: now.toISOString()
    });

  } catch (error) {
    console.error('Error predicting financial trends:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});