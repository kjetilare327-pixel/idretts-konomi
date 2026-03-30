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
    const actual = thisMonthTx.filter(t => t.category === b.category && t.type === b.type).reduce((sum, t) => sum + t.amount, 0);
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

    // Parse body (may be empty for scheduled runs)
    let team_id = null;
    try {
      const body = await req.json();
      team_id = body?.team_id || null;
    } catch (_) {}

    const isScheduled = !team_id;

    if (!isScheduled) {
      // Manual call from frontend — require auth + team role
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      if (user.role !== 'admin') {
        const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id, user_email: user.email.toLowerCase() });
        const allowedRoles = ['admin', 'kasserer', 'styreleder', 'revisor'];
        if (!membership.length || !allowedRoles.includes(membership[0].role)) {
          return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }
      }

      const result = await runAnalysisForTeam(base44, team_id);
      return Response.json({ success: true, ...result });
    }

    // Scheduled: validate scheduler secret
    const schedulerSecret = Deno.env.get('SCHEDULER_SECRET');
    if (schedulerSecret) {
      const authHeader = req.headers.get('Authorization') || '';
      if (authHeader !== `Bearer ${schedulerSecret}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

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

  } catch (error) {
    console.error('Error analyzing financials:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});