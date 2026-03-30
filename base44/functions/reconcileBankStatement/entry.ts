import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { team_id, file_url } = await req.json();
    if (!team_id || !file_url) return Response.json({ error: 'team_id and file_url are required' }, { status: 400 });

    // Require admin or kasserer
    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id, user_email: user.email.toLowerCase() });
      const allowedRoles = ['admin', 'kasserer'];
      if (!membership.length || !allowedRoles.includes(membership[0].role)) {
        return Response.json({ error: 'Forbidden: Krever admin eller kasserer' }, { status: 403 });
      }
    }

    const fileResponse = await fetch(file_url);
    const fileText = await fileResponse.text();

    const lines = fileText.split('\n').filter(l => l.trim());
    const bankTransactions = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(';').map(p => p.trim().replace(/"/g, ''));
      if (parts.length < 3) continue;

      const [dateStr, description, amountStr, , reference] = parts;
      const [day, month, year] = dateStr.split('.');
      const date = `${year}-${month}-${day}`;
      const amount = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.'));
      if (isNaN(amount)) continue;

      bankTransactions.push({ team_id, transaction_date: date, amount, description, reference: reference || '', uploaded_by: user.email });
    }

    const created = await base44.asServiceRole.entities.BankTransaction.bulkCreate(bankTransactions);

    let matched = 0;
    let reconciledTransactions = 0;

    for (const bankTx of created) {
      if (bankTx.reference) {
        const claims = await base44.asServiceRole.entities.Claim.filter({ team_id, kid_reference: bankTx.reference, status: 'pending' });
        if (claims.length > 0) {
          const claim = claims[0];
          if (Math.abs(bankTx.amount) === claim.amount) {
            await base44.asServiceRole.entities.Claim.update(claim.id, { status: 'paid' });
            await base44.asServiceRole.entities.BankTransaction.update(bankTx.id, { matched_claim_id: claim.id, reconciled: true });
            matched++;
          }
        }
      }

      const transactions = await base44.asServiceRole.entities.Transaction.filter({ team_id, date: bankTx.transaction_date, reconciled: 'unreconciled' });
      for (const tx of transactions) {
        const txAmount = tx.type === 'income' ? tx.amount : -tx.amount;
        if (Math.abs(txAmount - bankTx.amount) < 0.01) {
          await base44.asServiceRole.entities.Transaction.update(tx.id, { reconciled: 'reconciled' });
          await base44.asServiceRole.entities.BankTransaction.update(bankTx.id, { matched_transaction_id: tx.id, reconciled: true });
          reconciledTransactions++;
          break;
        }
      }
    }

    return Response.json({
      success: true,
      imported: bankTransactions.length,
      matched_claims: matched,
      reconciled_transactions: reconciledTransactions,
      message: `Importerte ${bankTransactions.length} transaksjoner. ${matched} krav markert som betalt. ${reconciledTransactions} transaksjoner avstemt.`
    });

  } catch (error) {
    console.error('Error reconciling bank statement:', error);
    return Response.json({ error: error.message, details: 'Kontroller at filen er i riktig CSV-format (Dato;Beskrivelse;Beløp;Saldo;Referanse)' }, { status: 500 });
  }
});