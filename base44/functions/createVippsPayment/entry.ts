import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { claim_id } = await req.json();
    if (!claim_id) return Response.json({ error: 'claim_id er påkrevd' }, { status: 400 });

    const claim = await base44.asServiceRole.entities.Claim.get(claim_id);
    if (!claim) return Response.json({ error: 'Krav ikke funnet' }, { status: 404 });
    if (claim.status === 'paid') return Response.json({ error: 'Kravet er allerede betalt' }, { status: 400 });

    // Require admin/kasserer OR the player themselves
    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id: claim.team_id, user_email: user.email.toLowerCase() });
      const isFinanceRole = membership.length && ['admin', 'kasserer'].includes(membership[0].role);
      
      // Allow player themselves to generate their own payment link
      const playerRecord = await base44.asServiceRole.entities.Player.filter({ team_id: claim.team_id, user_email: user.email.toLowerCase() }).catch(() => []);
      const isOwnClaim = playerRecord.length > 0 && claim.player_id === playerRecord[0].id;

      if (!isFinanceRole && !isOwnClaim) {
        return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
      }
    }

    const player = await base44.asServiceRole.entities.Player.get(claim.player_id);
    if (!player) return Response.json({ error: 'Spiller ikke funnet' }, { status: 404 });

    const orderId = `VIORD-${Date.now()}-${claim_id.substring(0, 8)}`;
    const paymentLink = `https://vipps.no/pay?orderId=${orderId}&amount=${Math.round(claim.amount * 100)}&merchant=IDRETTSOEKONOMI`;

    // Cancel any previous pending payment for this claim
    const existing = await base44.asServiceRole.entities.Payment.filter({ claim_id, status: 'pending' }).catch(() => []);
    for (const p of existing) {
      await base44.asServiceRole.entities.Payment.update(p.id, { status: 'failed' }).catch(() => {});
    }

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

    await base44.asServiceRole.entities.Claim.update(claim_id, {
      vipps_payment_link: paymentLink,
      kid_reference: orderId,
    });

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: player.user_email,
        subject: `Betalingslenke – ${claim.type}: ${claim.description || ''}`,
        body: `Hei ${player.full_name},\n\nHer er din betalingslenke:\n\nBeløp: ${claim.amount} NOK\nForfall: ${new Date(claim.due_date).toLocaleDateString('nb-NO')}\nReferanse: ${orderId}\n\nBetal nå: ${paymentLink}\n\nMvh\nIdrettsØkonomi`,
      });
    } catch (emailErr) {
      console.warn('E-post sending feilet:', emailErr.message);
    }

    await base44.asServiceRole.entities.AuditLog.create({ team_id: claim.team_id, user_email: user.email.toLowerCase(), action: 'create', entity_type: 'Payment', entity_id: payment.id, description: `Vipps betalingslenke opprettet for krav ${claim_id} – ${orderId}`, timestamp: new Date().toISOString() }).catch(() => {});

    return Response.json({ success: true, payment_id: payment.id, payment_link: paymentLink, order_id: orderId });

  } catch (error) {
    console.error('createVippsPayment feil:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});