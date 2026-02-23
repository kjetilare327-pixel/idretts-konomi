import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Creates a Vipps payment link for a claim and stores pending payment record.
// Also sends the link by email to the player.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { claim_id } = await req.json();
    if (!claim_id) return Response.json({ error: 'claim_id er påkrevd' }, { status: 400 });

    const claim = await base44.asServiceRole.entities.Claim.get(claim_id);
    if (!claim) return Response.json({ error: 'Krav ikke funnet' }, { status: 404 });
    if (claim.status === 'paid') return Response.json({ error: 'Kravet er allerede betalt' }, { status: 400 });

    const player = await base44.asServiceRole.entities.Player.get(claim.player_id);
    if (!player) return Response.json({ error: 'Spiller ikke funnet' }, { status: 404 });

    // Generate unique order reference
    const orderId = `VIORD-${Date.now()}-${claim_id.substring(0, 8)}`;

    // In production: replace this URL with real Vipps ePay API call
    // POST https://apitest.vipps.no/epayment/v1/payments
    const paymentLink = `https://vipps.no/pay?orderId=${orderId}&amount=${Math.round(claim.amount * 100)}&merchant=IDRETTSOEKONOMI`;

    // Cancel any previous pending payment for this claim to avoid duplicates
    const existing = await base44.asServiceRole.entities.Payment.filter({ claim_id, status: 'pending' }).catch(() => []);
    for (const p of existing) {
      await base44.asServiceRole.entities.Payment.update(p.id, { status: 'failed' }).catch(() => {});
    }

    // Create new pending payment record
    const payment = await base44.asServiceRole.entities.Payment.create({
      team_id: claim.team_id,
      player_id: claim.player_id,
      claim_id: claim.id,
      amount: claim.amount,
      payment_method: 'vipps',
      status: 'pending',
      transaction_id: orderId,
      vipps_payment_link: paymentLink,
    });

    // Store link on the claim itself for easy access
    await base44.asServiceRole.entities.Claim.update(claim_id, {
      vipps_payment_link: paymentLink,
      kid_reference: orderId,
    });

    // Send email with payment link
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: player.user_email,
        subject: `Betalingslenke – ${claim.type}: ${claim.description || ''}`,
        body: `Hei ${player.full_name},\n\nHer er din betalingslenke:\n\nBeløp: ${claim.amount} NOK\nForfall: ${new Date(claim.due_date).toLocaleDateString('nb-NO')}\nReferanse: ${orderId}\n\nBetal nå: ${paymentLink}\n\nMvh\nIdrettsØkonomi`,
      });
    } catch (emailErr) {
      console.warn('E-post sending feilet:', emailErr.message);
    }

    return Response.json({
      success: true,
      payment_id: payment.id,
      payment_link: paymentLink,
      order_id: orderId,
    });

  } catch (error) {
    console.error('createVippsPayment feil:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});