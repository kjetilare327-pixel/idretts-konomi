import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { payment_id, status } = await req.json();
    if (!payment_id || !status) return Response.json({ error: 'payment_id and status required' }, { status: 400 });

    const payment = await base44.asServiceRole.entities.Payment.get(payment_id);
    if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });

    // Require admin/kasserer for this team, or the player themselves
    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id: payment.team_id, user_email: user.email.toLowerCase() });
      const isFinanceRole = membership.length && ['admin', 'kasserer'].includes(membership[0].role);

      const playerRecord = await base44.asServiceRole.entities.Player.filter({ team_id: payment.team_id, user_email: user.email.toLowerCase() }).catch(() => []);
      const isOwnPayment = playerRecord.length > 0 && payment.player_id === playerRecord[0].id;

      if (!isFinanceRole && !isOwnPayment) {
        return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
      }
    }

    await base44.asServiceRole.entities.Payment.update(payment_id, {
      status,
      paid_at: status === 'completed' ? new Date().toISOString() : null
    });

    if (status === 'completed') {
      await base44.asServiceRole.entities.Claim.update(payment.claim_id, { status: 'paid' });

      const player = await base44.asServiceRole.entities.Player.get(payment.player_id);
      const newBalance = (player.balance || 0) - payment.amount;

      await base44.asServiceRole.entities.Player.update(payment.player_id, {
        balance: newBalance,
        payment_status: newBalance > 0 ? 'partial' : 'paid'
      });

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

      const claim = await base44.asServiceRole.entities.Claim.get(payment.claim_id);
      const team = await base44.asServiceRole.entities.Team.get(payment.team_id);
      const receiptText = `KVITTERING\n\nBetalingsmottaker: ${team.name}\nBetaler: ${player.full_name}\nBeløp: ${payment.amount} kr\nBetalingsmetode: ${payment.payment_method}\nTransaksjon: ${payment.transaction_id}\nDato: ${new Date().toLocaleDateString('nb-NO')}\n\nBeskrivelse: ${claim.description}\nType: ${claim.type}\n\nTakk for betalingen!`;

      const receiptBlob = new Blob([receiptText], { type: 'text/plain' });
      const receiptFile = new File([receiptBlob], `kvittering-${payment_id}.txt`);
      const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: receiptFile });

      await base44.asServiceRole.entities.Payment.update(payment_id, { receipt_url: file_url });

      await base44.asServiceRole.entities.AuditLog.create({ team_id: payment.team_id, user_email: user.email.toLowerCase(), action: 'approve', entity_type: 'Payment', entity_id: payment_id, description: `Betaling fullført via ${payment.payment_method} – ${payment.transaction_id || payment_id}`, timestamp: new Date().toISOString() }).catch(() => {});

      return Response.json({ success: true, message: 'Betaling fullført', receipt_url: file_url });
    }

    return Response.json({ success: true, message: `Betalingsstatus oppdatert til ${status}` });

  } catch (error) {
    console.error('Error processing payment:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});