import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payment_id, transaction_id } = await req.json();

    if (!payment_id) {
      return Response.json({ error: 'payment_id required' }, { status: 400 });
    }

    // Get payment details
    const payment = await base44.asServiceRole.entities.Payment.get(payment_id);
    if (!payment) {
      return Response.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Update payment status
    await base44.asServiceRole.entities.Payment.update(payment_id, {
      status: 'completed',
      paid_at: new Date().toISOString(),
      transaction_id: transaction_id || payment.transaction_id
    });

    // Update claim status
    if (payment.claim_id) {
      await base44.asServiceRole.entities.Claim.update(payment.claim_id, {
        status: 'paid'
      });
    }

    // Update player balance
    const player = await base44.asServiceRole.entities.Player.get(payment.player_id);
    if (player) {
      const newBalance = (player.balance || 0) - payment.amount;
      await base44.asServiceRole.entities.Player.update(payment.player_id, {
        balance: newBalance,
        payment_status: newBalance > 0 ? 'partial' : 'paid'
      });
    }

    // Create income transaction
    await base44.asServiceRole.entities.Transaction.create({
      team_id: payment.team_id,
      player_id: payment.player_id,
      type: 'income',
      category: 'Kontingent',
      amount: payment.amount,
      date: new Date().toISOString().split('T')[0],
      description: `Betaling mottatt via Vipps - ${transaction_id || payment.transaction_id}`,
      status: 'active',
      reconciled: 'reconciled'
    });

    // Send confirmation email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: player.user_email,
      subject: 'Betalingsbekreftelse',
      body: `
        Hei ${player.full_name},

        Din betaling er mottatt og registrert.

        Beløp: ${payment.amount} NOK
        Referanse: ${transaction_id || payment.transaction_id}
        Dato: ${new Date().toLocaleDateString('nb-NO')}

        Ny saldo: ${newBalance} NOK

        Takk for betalingen!

        Med vennlig hilsen,
        IdrettsØkonomi
      `
    });

    return Response.json({
      success: true,
      payment_id,
      new_balance: player.balance - payment.amount,
      message: 'Payment completed successfully'
    });

  } catch (error) {
    console.error('Complete payment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});