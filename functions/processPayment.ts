import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payment_id, status } = await req.json();
    
    if (!payment_id || !status) {
      return Response.json({ error: 'payment_id and status required' }, { status: 400 });
    }

    // Hent betalingen
    const payment = await base44.asServiceRole.entities.Payment.get(payment_id);
    
    // Oppdater betalingsstatus
    await base44.asServiceRole.entities.Payment.update(payment_id, {
      status,
      paid_at: status === 'completed' ? new Date().toISOString() : null
    });

    if (status === 'completed') {
      // Oppdater claim status
      await base44.asServiceRole.entities.Claim.update(payment.claim_id, {
        status: 'paid'
      });

      // Hent spiller og oppdater saldo
      const player = await base44.asServiceRole.entities.Player.get(payment.player_id);
      const newBalance = (player.balance || 0) - payment.amount;
      
      await base44.asServiceRole.entities.Player.update(payment.player_id, {
        balance: newBalance,
        payment_status: newBalance > 0 ? 'partial' : 'paid'
      });

      // Opprett transaksjon
      await base44.asServiceRole.entities.Transaction.create({
        team_id: payment.team_id,
        player_id: payment.player_id,
        type: 'income',
        category: 'Kontingent',
        amount: payment.amount,
        date: new Date().toISOString().split('T')[0],
        description: `Betaling mottatt via ${payment.payment_method}`,
        status: 'active',
        reconciled: 'reconciled'
      });

      // Generer kvittering
      const claim = await base44.asServiceRole.entities.Claim.get(payment.claim_id);
      const receiptText = `KVITTERING
      
Betalingsmottaker: ${(await base44.asServiceRole.entities.Team.get(payment.team_id)).name}
Betaler: ${player.full_name}
Beløp: ${payment.amount} kr
Betalingsmetode: ${payment.payment_method}
Transaksjon: ${payment.transaction_id}
Dato: ${new Date().toLocaleDateString('nb-NO')}

Beskrivelse: ${claim.description}
Type: ${claim.type}

Takk for betalingen!`;

      const receiptBlob = new Blob([receiptText], { type: 'text/plain' });
      const receiptFile = new File([receiptBlob], `kvittering-${payment_id}.txt`);
      
      const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({
        file: receiptFile
      });

      await base44.asServiceRole.entities.Payment.update(payment_id, {
        receipt_url: file_url
      });

      return Response.json({
        success: true,
        message: 'Betaling fullført',
        receipt_url: file_url
      });
    }

    return Response.json({
      success: true,
      message: `Betalingsstatus oppdatert til ${status}`
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});