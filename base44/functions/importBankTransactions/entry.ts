import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { teamId, transactions } = await req.json();
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return Response.json({ error: 'No transactions provided' }, { status: 400 });
    }

    // Require admin or kasserer
    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id: teamId, user_email: user.email.toLowerCase() });
      const allowedRoles = ['admin', 'kasserer'];
      if (!membership.length || !allowedRoles.includes(membership[0].role)) {
        return Response.json({ error: 'Forbidden: Krever admin eller kasserer' }, { status: 403 });
      }
    }

    const [existingTransactions, existingBankTx, categories, claims] = await Promise.all([
      base44.asServiceRole.entities.Transaction.filter({ team_id: teamId }),
      base44.asServiceRole.entities.BankTransaction.filter({ team_id: teamId }),
      base44.asServiceRole.entities.Category.filter({ team_id: teamId }),
      base44.asServiceRole.entities.Claim.filter({ team_id: teamId })
    ]);

    const categorizedTransactions = [];

    for (const tx of transactions) {
      const exists = existingBankTx.find(bt =>
        bt.transaction_date === tx.date &&
        bt.amount === tx.amount &&
        bt.description === tx.description
      );
      if (exists) continue;

      let matchedClaim = null;
      if (tx.reference && tx.amount > 0) {
        matchedClaim = claims.find(c =>
          c.kid_reference === tx.reference &&
          c.amount === tx.amount &&
          c.status === 'pending'
        );
      }

      let suggestedCategory = null;
      let suggestedType = tx.amount > 0 ? 'income' : 'expense';

      try {
        const aiPrompt = `
Basert på følgende banktransaksjon, foreslå en passende kategori fra listen nedenfor.

Transaksjon:
- Beskrivelse: ${tx.description}
- Beløp: ${tx.amount} NOK

Tilgjengelige kategorier:
${categories.map(c => `- ${c.name} (${c.type})`).join('\n')}

Returner BARE kategorinavnet, ingenting annet.`;

        const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: aiPrompt });
        suggestedCategory = aiResponse.trim();
        const categoryExists = categories.find(c => c.name.toLowerCase() === suggestedCategory.toLowerCase());
        if (!categoryExists) suggestedCategory = suggestedType === 'income' ? 'Annet' : 'Diverse utgifter';
      } catch (error) {
        console.error('AI categorization failed:', error);
        suggestedCategory = suggestedType === 'income' ? 'Annet' : 'Diverse utgifter';
      }

      categorizedTransactions.push({
        originalData: tx, suggestedCategory, suggestedType,
        matchedClaim: matchedClaim ? { id: matchedClaim.id, player_id: matchedClaim.player_id, description: matchedClaim.description } : null,
        confidence: matchedClaim ? 'high' : 'medium'
      });
    }

    const createdBankTransactions = [];
    for (const ctx of categorizedTransactions) {
      const tx = ctx.originalData;
      const bankTx = await base44.asServiceRole.entities.BankTransaction.create({
        team_id: teamId,
        transaction_date: tx.date,
        amount: tx.amount,
        description: tx.description,
        reference: tx.reference || null,
        matched_claim_id: ctx.matchedClaim?.id || null,
        reconciled: false,
        uploaded_by: user.email
      });
      createdBankTransactions.push({ ...bankTx, suggested: { category: ctx.suggestedCategory, type: ctx.suggestedType, matchedClaim: ctx.matchedClaim, confidence: ctx.confidence } });
    }

    const autoApproved = [];
    for (const btx of createdBankTransactions) {
      if (btx.suggested.confidence === 'high' && btx.suggested.matchedClaim) {
        const transaction = await base44.asServiceRole.entities.Transaction.create({
          team_id: teamId, type: btx.amount > 0 ? 'income' : 'expense',
          category: btx.suggested.category, amount: Math.abs(btx.amount),
          date: btx.transaction_date, description: btx.description, reconciled: 'reconciled'
        });
        await base44.asServiceRole.entities.BankTransaction.update(btx.id, { matched_transaction_id: transaction.id, reconciled: true });
        if (btx.suggested.matchedClaim) {
          await base44.asServiceRole.entities.Claim.update(btx.suggested.matchedClaim.id, { status: 'paid' });
          await base44.asServiceRole.entities.Payment.create({
            team_id: teamId, player_id: btx.suggested.matchedClaim.player_id,
            claim_id: btx.suggested.matchedClaim.id, amount: Math.abs(btx.amount),
            payment_method: 'bank_transfer', status: 'completed',
            paid_at: new Date(btx.transaction_date).toISOString()
          });
        }
        autoApproved.push(btx.id);
      }
    }

    return Response.json({
      success: true,
      imported: categorizedTransactions.length,
      autoApproved: autoApproved.length,
      needsReview: categorizedTransactions.length - autoApproved.length,
      transactions: createdBankTransactions
    });

  } catch (error) {
    console.error('Error importing bank transactions:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});