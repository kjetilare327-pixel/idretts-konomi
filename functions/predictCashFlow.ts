import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { team_id, months_ahead = 3 } = await req.json();
    if (!team_id) {
      return Response.json({ error: 'team_id required' }, { status: 400 });
    }

    // Fetch data
    const [transactions, claims, events, budgets] = await Promise.all([
      base44.asServiceRole.entities.Transaction.filter({ team_id, status: 'active' }),
      base44.asServiceRole.entities.Claim.filter({ team_id }),
      base44.asServiceRole.entities.Event.filter({ team_id }),
      base44.asServiceRole.entities.Budget.filter({ team_id })
    ]);

    // Calculate historical monthly averages
    const monthlyAverages = { income: 0, expense: 0 };
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentTransactions = transactions.filter(t => new Date(t.date) >= sixMonthsAgo);
    
    recentTransactions.forEach(t => {
      if (t.type === 'income') monthlyAverages.income += t.amount / 6;
      else monthlyAverages.expense += t.amount / 6;
    });

    // Predict future months
    const predictions = [];
    const today = new Date();

    for (let i = 0; i < months_ahead; i++) {
      const targetDate = new Date(today);
      targetDate.setMonth(targetDate.getMonth() + i + 1);
      const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

      // Start with historical baseline
      let predictedIncome = monthlyAverages.income;
      let predictedExpense = monthlyAverages.expense;

      // Add expected income from unpaid claims due this month
      const monthClaims = claims.filter(c => {
        const dueDate = new Date(c.due_date);
        return dueDate.getMonth() === targetDate.getMonth() && 
               dueDate.getFullYear() === targetDate.getFullYear() &&
               (c.status === 'pending' || c.status === 'overdue');
      });
      const expectedClaimIncome = monthClaims.reduce((sum, c) => sum + (c.amount * 0.85), 0); // 85% collection rate
      predictedIncome += expectedClaimIncome;

      // Add event-related expenses
      const monthEvents = events.filter(e => {
        const eventDate = new Date(e.date);
        return eventDate.getMonth() === targetDate.getMonth() && 
               eventDate.getFullYear() === targetDate.getFullYear() &&
               (e.type === 'tournament' || e.type === 'social');
      });
      const eventExpenses = monthEvents.length * 3000; // Estimated 3000 NOK per event
      predictedExpense += eventExpenses;

      // Budget comparison
      const budgetIncome = budgets.filter(b => b.type === 'income').reduce((sum, b) => sum + b.monthly_amount, 0);
      const budgetExpense = budgets.filter(b => b.type === 'expense').reduce((sum, b) => sum + b.monthly_amount, 0);

      const netPrediction = predictedIncome - predictedExpense;
      const budgetVariance = netPrediction - (budgetIncome - budgetExpense);

      predictions.push({
        month: targetDate.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' }),
        monthKey,
        predicted_income: Math.round(predictedIncome),
        predicted_expense: Math.round(predictedExpense),
        net_prediction: Math.round(netPrediction),
        budget_income: Math.round(budgetIncome),
        budget_expense: Math.round(budgetExpense),
        budget_variance: Math.round(budgetVariance),
        confidence: i === 0 ? 'high' : i === 1 ? 'medium' : 'low',
        factors: {
          unpaid_claims: monthClaims.length,
          expected_claim_income: Math.round(expectedClaimIncome),
          scheduled_events: monthEvents.length,
          estimated_event_costs: Math.round(eventExpenses)
        }
      });
    }

    // Generate alerts
    const alerts = [];
    predictions.forEach((pred, idx) => {
      if (pred.net_prediction < 0) {
        alerts.push({
          severity: 'high',
          month: pred.month,
          type: 'negative_cashflow',
          message: `Forventet negativt kontantstrøm på ${Math.abs(pred.net_prediction)} NOK`
        });
      }
      if (pred.budget_variance < -5000) {
        alerts.push({
          severity: 'medium',
          month: pred.month,
          type: 'budget_risk',
          message: `Estimert underskudd på ${Math.abs(pred.budget_variance)} NOK vs. budsjett`
        });
      }
    });

    return Response.json({
      success: true,
      predictions,
      alerts,
      summary: {
        total_predicted_income: predictions.reduce((sum, p) => sum + p.predicted_income, 0),
        total_predicted_expense: predictions.reduce((sum, p) => sum + p.predicted_expense, 0),
        net_position: predictions.reduce((sum, p) => sum + p.net_prediction, 0)
      }
    });

  } catch (error) {
    console.error('Cash flow prediction error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});