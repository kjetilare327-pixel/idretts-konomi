import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { team_id, period = 'yearly' } = await req.json();
    
    if (!team_id) {
      return Response.json({ error: 'team_id is required' }, { status: 400 });
    }

    // Hent historiske data
    const [transactions, budgets, team] = await Promise.all([
      base44.asServiceRole.entities.Transaction.filter({ team_id }),
      base44.asServiceRole.entities.Budget.filter({ team_id }),
      base44.asServiceRole.entities.Team.get(team_id)
    ]);

    // Analyser historikk
    const now = new Date();
    const lastYear = new Date(now.getFullYear() - 1, 0, 1);
    const twoYearsAgo = new Date(now.getFullYear() - 2, 0, 1);

    const lastYearTx = transactions.filter(t => new Date(t.date) >= lastYear);
    const twoYearsAgoTx = transactions.filter(t => new Date(t.date) >= twoYearsAgo && new Date(t.date) < lastYear);

    // Beregn nøkkeltall
    const lastYearIncome = lastYearTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const lastYearExpense = lastYearTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const twoYearsIncome = twoYearsAgoTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const twoYearsExpense = twoYearsAgoTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    // Vekstrate
    const incomeGrowth = twoYearsIncome > 0 ? ((lastYearIncome - twoYearsIncome) / twoYearsIncome * 100) : 0;
    const expenseGrowth = twoYearsExpense > 0 ? ((lastYearExpense - twoYearsExpense) / twoYearsExpense * 100) : 0;

    // Kategoriserte utgifter og inntekter
    const expenseByCategory = {};
    const incomeByCategory = {};
    
    lastYearTx.forEach(t => {
      if (t.type === 'expense') {
        expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
      } else {
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
      }
    });

    // Sesongvariasjoner
    const monthlyData = {};
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = { income: 0, expense: 0 };
    }
    lastYearTx.forEach(t => {
      const month = new Date(t.date).getMonth();
      if (t.type === 'income') {
        monthlyData[month].income += t.amount;
      } else {
        monthlyData[month].expense += t.amount;
      }
    });

    // Finn topp/bunn måneder
    const monthlyExpenses = Object.entries(monthlyData).map(([m, d]) => ({ month: parseInt(m), expense: d.expense }));
    const avgMonthlyExpense = monthlyExpenses.reduce((sum, m) => sum + m.expense, 0) / 12;
    const maxExpenseMonth = monthlyExpenses.reduce((max, m) => m.expense > max.expense ? m : max);
    const minExpenseMonth = monthlyExpenses.reduce((min, m) => m.expense < min.expense ? m : min);

    // Prompt til AI
    const prompt = `Du er en økonomisk rådgiver for idrettslag i Norge. Analyser historiske data og foreslå et optimalt budsjett for kommende periode.

LAG: ${team.name}
TYPE IDRETT: ${team.sport_type}
PERIODE: ${period === 'yearly' ? 'Årlig' : 'Månedlig'}

HISTORISK ANALYSE (siste år):
- Totale inntekter: ${lastYearIncome.toLocaleString('nb-NO')} kr
- Totale utgifter: ${lastYearExpense.toLocaleString('nb-NO')} kr
- Netto resultat: ${(lastYearIncome - lastYearExpense).toLocaleString('nb-NO')} kr

VEKSTRATE (vs. året før):
- Inntektsvekst: ${incomeGrowth.toFixed(1)}%
- Utgiftsvekst: ${expenseGrowth.toFixed(1)}%

INNTEKTER PER KATEGORI:
${Object.entries(incomeByCategory).map(([cat, amt]) => `- ${cat}: ${amt.toLocaleString('nb-NO')} kr`).join('\n')}

UTGIFTER PER KATEGORI:
${Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([cat, amt]) => `- ${cat}: ${amt.toLocaleString('nb-NO')} kr`).join('\n')}

SESONGVARIASJONER:
- Gjennomsnittlig månedlig utgift: ${avgMonthlyExpense.toLocaleString('nb-NO')} kr
- Høyeste utgiftsmåned: ${new Date(2000, maxExpenseMonth.month).toLocaleDateString('nb-NO', { month: 'long' })} (${maxExpenseMonth.expense.toLocaleString('nb-NO')} kr)
- Laveste utgiftsmåned: ${new Date(2000, minExpenseMonth.month).toLocaleDateString('nb-NO', { month: 'long' })} (${minExpenseMonth.expense.toLocaleString('nb-NO')} kr)

NÅVÆRENDE BUDSJETT:
${budgets.length > 0 ? budgets.map(b => `- ${b.category} (${b.type === 'income' ? 'Inntekt' : 'Utgift'}): ${b.monthly_amount.toLocaleString('nb-NO')} kr/mnd`).join('\n') : 'Ingen budsjett satt'}

OPPGAVE:
Basert på historiske data og trender, foreslå et optimalt budsjett for kommende periode. Gi:

1. BUDSJETTFORSLAG per kategori (både inntekt og utgift)
2. OPTIMALISERINGSMULIGHETER (områder hvor laget kan spare penger)
3. FREMTIDIG LIKVIDITET (prognose basert på nåværende bane)
4. ANBEFALINGER (spesifikke tiltak for bedre økonomi)

Ta hensyn til:
- Historiske trender og vekstrater
- Sesongvariasjoner (viktig for ${team.sport_type})
- Norske idrettslags typiske inntekts- og utgiftsmønstre
- Realisme og gjennomførbarhet

Format svaret strukturert på norsk med konkrete tall og beløp.`;

    // Kall AI
    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          recommended_budgets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                type: { type: 'string', enum: ['income', 'expense'] },
                monthly_amount: { type: 'number' },
                yearly_amount: { type: 'number' },
                reasoning: { type: 'string' }
              }
            }
          },
          optimization_opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                area: { type: 'string' },
                current_spend: { type: 'number' },
                potential_savings: { type: 'number' },
                action: { type: 'string' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] }
              }
            }
          },
          liquidity_forecast: {
            type: 'object',
            properties: {
              next_3_months: { type: 'number' },
              next_6_months: { type: 'number' },
              next_12_months: { type: 'number' },
              risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
              description: { type: 'string' }
            }
          },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                impact: { type: 'string', enum: ['high', 'medium', 'low'] },
                effort: { type: 'string', enum: ['high', 'medium', 'low'] }
              }
            }
          },
          summary: { type: 'string' }
        }
      }
    });

    return Response.json({
      success: true,
      budget_plan: aiResponse,
      historical_data: {
        last_year_income: lastYearIncome,
        last_year_expense: lastYearExpense,
        income_growth: incomeGrowth,
        expense_growth: expenseGrowth
      }
    });

  } catch (error) {
    console.error('Error suggesting budget plan:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});