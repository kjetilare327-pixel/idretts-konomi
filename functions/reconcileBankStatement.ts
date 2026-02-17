import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { team_id, file_url } = await req.json();
    
    if (!team_id || !file_url) {
      return Response.json({ error: 'team_id and file_url are required' }, { status: 400 });
    }

    // Hent filen
    const fileResponse = await fetch(file_url);
    const fileText = await fileResponse.text();
    
    // Parse CSV (norsk bankformat)
    const lines = fileText.split('\n').filter(l => l.trim());
    const bankTransactions = [];
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Format: Dato;Beskrivelse;Beløp;Saldo;KID/Referanse
      const parts = line.split(';').map(p => p.trim().replace(/"/g, ''));
      
      if (parts.length < 3) continue;
      
      const [dateStr, description, amountStr, , reference] = parts;
      
      // Parse norsk datoformat (DD.MM.YYYY)
      const [day, month, year] = dateStr.split('.');
      const date = `${year}-${month}-${day}`;
      
      // Parse beløp (norsk format: 1 234,56)
      const amount = parseFloat(amountStr.replace(/\s/g, '').replace(',', '.'));
      
      if (isNaN(amount)) continue;
      
      bankTransactions.push({
        team_id,
        transaction_date: date,
        amount,
        description,
        reference: reference || '',
        uploaded_by: user.email
      });
    }

    // Lagre banktransaksjoner
    const created = await base44.entities.BankTransaction.bulkCreate(bankTransactions);
    
    // Match med eksisterende transaksjoner og krav
    let matched = 0;
    let reconciledTransactions = 0;
    
    for (const bankTx of created) {
      // Match med krav via KID
      if (bankTx.reference) {
        const claims = await base44.entities.Claim.filter({ 
          team_id,
          kid_reference: bankTx.reference,
          status: 'pending'
        });
        
        if (claims.length > 0) {
          const claim = claims[0];
          if (Math.abs(bankTx.amount) === claim.amount) {
            await base44.entities.Claim.update(claim.id, { status: 'paid' });
            await base44.entities.BankTransaction.update(bankTx.id, { 
              matched_claim_id: claim.id,
              reconciled: true
            });
            matched++;
          }
        }
      }
      
      // Match med transaksjoner basert på dato og beløp
      const transactions = await base44.entities.Transaction.filter({
        team_id,
        date: bankTx.transaction_date,
        reconciled: 'unreconciled'
      });
      
      for (const tx of transactions) {
        const txAmount = tx.type === 'income' ? tx.amount : -tx.amount;
        if (Math.abs(txAmount - bankTx.amount) < 0.01) {
          await base44.entities.Transaction.update(tx.id, { reconciled: 'reconciled' });
          await base44.entities.BankTransaction.update(bankTx.id, { 
            matched_transaction_id: tx.id,
            reconciled: true
          });
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
    return Response.json({ 
      error: error.message,
      details: 'Kontroller at filen er i riktig CSV-format (Dato;Beskrivelse;Beløp;Saldo;Referanse)'
    }, { status: 500 });
  }
});