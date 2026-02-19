import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function runAnalysisForTeam(base44, team_id) {
  const [transactions, budgets, claims, team] = await Promise.all([
    base44.asServiceRole.entities.Transaction.filter({ team_id }),
    base44.asServiceRole.entities.Budget.filter({ team_id }),
    base44.asServiceRole.entities.Claim.filter({ team_id }),
    base44.asServiceRole.entities.Team.get(team_id)
  ]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const lastMonthTx = transactions.filter(t => {
    const d = new Date(t.date);
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
  });

  const thisMonthIncome = thisMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const thisMonthExpense = thisMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const lastMonthIncome = lastMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const lastMonthExpense = lastMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  const budgetVariances = budgets.map(b => {
    const actual = thisMonthTx
      .filter(t => t.category === b.category && t.type === b.type)
      .reduce((sum, t) => sum + t.amount, 0);
    const variance = actual - b.monthly_amount;
    const percentUsed = b.monthly_amount > 0 ? (actual / b.monthly_amount * 100) : 0;
    return { category: b.category, type: b.type, budgeted: b.monthly_amount, actual, variance, percentUsed };
  });

  const pendingClaims = claims.filter(c => c.status === 'pending' || c.status === 'overdue');
  const totalPending = pendingClaims.reduce((sum, c) => sum + c.amount, 0);

  const expensesByCategory = {};
  thisMonthTx.filter(t => t.type === 'expense').forEach(t => {
    expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
  });

  const safePercent = (a, b) => b === 0 ? '0.0' : ((a - b) / b * 100).toFixed(1);

  const prompt = `Du er en økonomisk rådgiver for idrettslag i Norge. Analyser følgende økonomiske data og gi konkrete, handlingsorienterte råd.

LAG: ${team.name}
TYPE IDRETT: ${team.sport_type}

NÅVÆRENDE MÅNED (${now.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })}):
- Inntekter: ${thisMonthIncome.toLocaleString('nb-NO')} kr
- Utgifter: ${thisMonthExpense.toLocaleString('nb-NO')} kr
- Netto: ${(thisMonthIncome - thisMonthExpense).toLocaleString('nb-NO')} kr

FORRIGE MÅNED:
- Inntekter: ${lastMonthIncome.toLocaleString('nb-NO')} kr
- Utgifter: ${lastMonthExpense.toLocaleString('nb-NO')} kr
- Endring i inntekter: ${safePercent(thisMonthIncome, lastMonthIncome)}%
- Endring i utgifter: ${safePercent(thisMonthExpense, lastMonthExpense)}%

BUDSJETTAVVIK (denne måneden):
${budgetVariances.map(v => `- ${v.category} (${v.type === 'income' ? 'Inntekt' : 'Utgift'}): Budsjett ${v.budgeted.toLocaleString('nb-NO')} kr, Faktisk ${v.actual.toLocaleString('nb-NO')} kr, Avvik ${v.variance.toLocaleString('nb-NO')} kr (${v.percentUsed.toFixed(0)}% brukt)`).join('\n')}

FORDRINGER:
- Totalt utestående: ${totalPending.toLocaleString('nb-NO')} kr
- Antall ubetalte krav: ${pendingClaims.length}

STØRSTE UTGIFTSKATEGORIER (denne måneden):
${Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, amt]) => `- ${cat}: ${amt.toLocaleString('nb-NO')} kr`).join('\n')}

Gi 3-5 konkrete, prioriterte anbefalinger. Vær spesifikk med tall og kategorier. Svar på norsk.`;

  const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        insights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['critical', 'warning', 'opportunity', 'info'] },
              title: { type: 'string' },
              description: { type: 'string' },
              action: { type: 'string' },
              savings_potential: { type: 'number' }
            }
          }
        },
        summary: { type: 'string' }
      }
    }
  });

  return {
    analysis: aiResponse,
    metadata: {
      analyzed_at: now.toISOString(),
      transactions_count: transactions.length,
      budgets_count: budgets.length,
      pending_claims: pendingClaims.length
    }
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Support both scheduled (no auth, no body) and manual invocation (with team_id)
    let team_id = null;
    try {
      const body = await req.json();
      team_id = body?.team_id || null;
    } catch (_) {
      // No body — running as scheduled automation
    }

    // If called from frontend, require auth
    const isScheduled = !team_id;
    if (!isScheduled) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Scheduled: run for all teams inline (no re-invocation to avoid 403)
    if (isScheduled) {
      const allTeams = await base44.asServiceRole.entities.Team.list();
      const results = [];
      for (const team of allTeams) {
        try {
          await runAnalysisForTeam(base44, team.id);
          results.push({ team_id: team.id, team_name: team.name, status: 'ok' });
        } catch (err) {
          console.error(`Failed for team ${team.id}:`, err.message);
          results.push({ team_id: team.id, team_name: team.name, status: 'error', error: err.message });
        }
      }
      return Response.json({ success: true, scheduled_run: true, results });
    }

    // Hent data
    const [transactions, budgets, claims, team] = await Promise.all([
      base44.asServiceRole.entities.Transaction.filter({ team_id }),
      base44.asServiceRole.entities.Budget.filter({ team_id }),
      base44.asServiceRole.entities.Claim.filter({ team_id }),
      base44.asServiceRole.entities.Team.get(team_id)
    ]);

    // Beregn nøkkeltall
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const lastMonthTx = transactions.filter(t => {
      const d = new Date(t.date);
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const thisMonthIncome = thisMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const thisMonthExpense = thisMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const lastMonthIncome = lastMonthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const lastMonthExpense = lastMonthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    // Budsjettavvik
    const budgetVariances = budgets.map(b => {
      const category = b.category;
      const monthlyBudget = b.monthly_amount;
      const actual = thisMonthTx
        .filter(t => t.category === category && t.type === b.type)
        .reduce((sum, t) => sum + t.amount, 0);
      const variance = actual - monthlyBudget;
      const percentUsed = monthlyBudget > 0 ? (actual / monthlyBudget * 100) : 0;
      
      return {
        category,
        type: b.type,
        budgeted: monthlyBudget,
        actual,
        variance,
        percentUsed
      };
    });

    // Fordringer
    const pendingClaims = claims.filter(c => c.status === 'pending' || c.status === 'overdue');
    const totalPending = pendingClaims.reduce((sum, c) => sum + c.amount, 0);

    // Kategorier med høyeste utgifter
    const expensesByCategory = {};
    thisMonthTx.filter(t => t.type === 'expense').forEach(t => {
      expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
    });

    // Prompt til AI
    const prompt = `Du er en økonomisk rådgiver for idrettslag i Norge. Analyser følgende økonomiske data og gi konkrete, handlingsorienterte råd.

LAG: ${team.name}
TYPE IDRETT: ${team.sport_type}

NÅVÆRENDE MÅNED (${new Date().toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })}):
- Inntekter: ${thisMonthIncome.toLocaleString('nb-NO')} kr
- Utgifter: ${thisMonthExpense.toLocaleString('nb-NO')} kr
- Netto: ${(thisMonthIncome - thisMonthExpense).toLocaleString('nb-NO')} kr

FORRIGE MÅNED:
- Inntekter: ${lastMonthIncome.toLocaleString('nb-NO')} kr
- Utgifter: ${lastMonthExpense.toLocaleString('nb-NO')} kr
- Endring i inntekter: ${((thisMonthIncome - lastMonthIncome) / lastMonthIncome * 100).toFixed(1)}%
- Endring i utgifter: ${((thisMonthExpense - lastMonthExpense) / lastMonthExpense * 100).toFixed(1)}%

BUDSJETTAVVIK (denne måneden):
${budgetVariances.map(v => `- ${v.category} (${v.type === 'income' ? 'Inntekt' : 'Utgift'}): Budsjett ${v.budgeted.toLocaleString('nb-NO')} kr, Faktisk ${v.actual.toLocaleString('nb-NO')} kr, Avvik ${v.variance.toLocaleString('nb-NO')} kr (${v.percentUsed.toFixed(0)}% brukt)`).join('\n')}

FORDRINGER:
- Totalt utestående: ${totalPending.toLocaleString('nb-NO')} kr
- Antall ubetalte krav: ${pendingClaims.length}

STØRSTE UTGIFTSKATEGORIER (denne måneden):
${Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, amt]) => `- ${cat}: ${amt.toLocaleString('nb-NO')} kr`).join('\n')}

OPPGAVE:
Analyser dataene og gi 3-5 konkrete, prioriterte anbefalinger for å forbedre økonomien. Fokuser på:
1. Identifiser kritiske budsjettavvik (over 20% avvik)
2. Foreslå konkrete kostnadsbesparelser
3. Gi innsikt i trender (økning/nedgang)
4. Foreslå tiltak for å innkreve utestående fordringer
5. Gi sesongbaserte råd relevant for ${team.sport_type}

Format svaret som korte, handlingsorienterte punkter på norsk. Vær spesifikk med tall og kategorier.`;

    // Kall AI
    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          insights: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['critical', 'warning', 'opportunity', 'info']
                },
                title: { type: 'string' },
                description: { type: 'string' },
                action: { type: 'string' },
                savings_potential: { type: 'number' }
              }
            }
          },
          summary: { type: 'string' }
        }
      }
    });

    return Response.json({
      success: true,
      analysis: aiResponse,
      metadata: {
        analyzed_at: new Date().toISOString(),
        transactions_count: transactions.length,
        budgets_count: budgets.length,
        pending_claims: pendingClaims.length
      }
    });

  } catch (error) {
    console.error('Error analyzing financials:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});