import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Returns aggregated team stats only — no personal data, safe for all roles.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { team_id } = body;
    if (!team_id) return Response.json({ error: 'team_id required' }, { status: 400 });

    const userEmail = user.email.toLowerCase();

    // Verify user belongs to this team (any role)
    const memberships = await base44.asServiceRole.entities.TeamMember.filter({ team_id });
    const myMembership = memberships.find(m => (m.user_email || '').toLowerCase() === userEmail && m.status === 'active');
    const teams = await base44.asServiceRole.entities.Team.filter({ id: team_id });
    const team = teams[0];
    const isCreator = (team?.created_by || '').toLowerCase() === userEmail;

    if (!myMembership && !isCreator) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch raw data using service role
    const [transactions, claims, players, bankTxns, budgets] = await Promise.all([
      base44.asServiceRole.entities.Transaction.filter({ team_id }).catch(() => []),
      base44.asServiceRole.entities.Claim.filter({ team_id }).catch(() => []),
      base44.asServiceRole.entities.Player.filter({ team_id }).catch(() => []),
      base44.asServiceRole.entities.BankTransaction.filter({ team_id }).catch(() => []),
      base44.asServiceRole.entities.Budget.filter({ team_id }).catch(() => []),
    ]);

    // ── Transaction aggregates ──────────────────────────────────────────────
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);

    // Monthly totals (last 12 months)
    const monthlyMap = {};
    for (const t of transactions) {
      if (!t.date) continue;
      const m = t.date.slice(0, 7); // YYYY-MM
      if (!monthlyMap[m]) monthlyMap[m] = { income: 0, expense: 0 };
      if (t.type === 'income') monthlyMap[m].income += t.amount || 0;
      else monthlyMap[m].expense += t.amount || 0;
    }
    const monthlyTotals = Object.entries(monthlyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, v]) => ({ month, ...v }));

    // Category totals
    const categoryMap = {};
    for (const t of transactions) {
      if (!categoryMap[t.category]) categoryMap[t.category] = { income: 0, expense: 0 };
      if (t.type === 'income') categoryMap[t.category].income += t.amount || 0;
      else categoryMap[t.category].expense += t.amount || 0;
    }
    const categoryTotals = Object.entries(categoryMap).map(([cat, v]) => ({ category: cat, ...v }));

    // ── Claims aggregates ──────────────────────────────────────────────────
    const totalClaimed = claims.reduce((s, c) => s + (c.amount || 0), 0);
    const paidClaims = claims.filter(c => c.status === 'paid').reduce((s, c) => s + (c.amount || 0), 0);
    const pendingClaims = claims.filter(c => c.status === 'pending').reduce((s, c) => s + (c.amount || 0), 0);
    const overdueClaims = claims.filter(c => c.status === 'overdue').reduce((s, c) => s + (c.amount || 0), 0);

    // ── Player/member counts (no names/emails) ────────────────────────────
    const activePlayers = players.filter(p => p.status !== 'archived').length;
    const memberCount = memberships.filter(m => m.status === 'active').length;

    // ── Bank reconciliation status ─────────────────────────────────────────
    const totalBankTxns = bankTxns.length;
    const reconciledCount = bankTxns.filter(t => t.reconciled).length;
    const unreconciledCount = totalBankTxns - reconciledCount;
    const lastReconciled = bankTxns.filter(t => t.reconciled).sort((a, b) =>
      (b.transaction_date || '').localeCompare(a.transaction_date || '')
    )[0]?.transaction_date || null;

    // ── Budget aggregates ─────────────────────────────────────────────────
    const totalBudgetIncome = budgets.filter(b => b.type === 'income').reduce((s, b) => s + (b.monthly_amount || 0), 0);
    const totalBudgetExpense = budgets.filter(b => b.type === 'expense').reduce((s, b) => s + (b.monthly_amount || 0), 0);
    const budgetByCategory = budgets.map(b => ({ category: b.category, type: b.type, monthly_amount: b.monthly_amount }));

    return Response.json({
      ok: true,
      totals: { totalIncome, totalExpense, net: totalIncome - totalExpense },
      claims: { totalClaimed, paidClaims, pendingClaims, overdueClaims },
      members: { activePlayers, memberCount },
      bank: { totalBankTxns, reconciledCount, unreconciledCount, lastReconciled },
      budget: { totalBudgetIncome, totalBudgetExpense, budgetByCategory },
      monthlyTotals,
      categoryTotals,
    });
  } catch (error) {
    console.error('[getTeamSummary] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});