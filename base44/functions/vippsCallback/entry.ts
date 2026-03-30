import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Webhook / callback endpoint for Vipps to notify payment completion.
// Also callable manually from admin UI to mark a payment as completed.
//
// Expected payload:
//   { order_id: string, status: "AUTHORIZED"|"SALE"|"completed"|"failed" }
//
// Vipps real webhook header: "Authorization" with merchant secret (set VIPPS_CALLBACK_SECRET)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Validate webhook secret OR require authenticated admin/kasserer user
    const vippsSecret = Deno.env.get('VIPPS_CALLBACK_SECRET');
    const authHeader = req.headers.get('Authorization') || '';
    const isValidWebhook = vippsSecret && authHeader === `Bearer ${vippsSecret}`;

    if (!isValidWebhook) {
      // Fall back to user auth for manual invocation from admin UI
      const user = await base44.auth.me().catch(() => null);
      if (!user) {
        console.warn('vippsCallback: rejected unauthenticated request');
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (user.role !== 'admin') {
        const body2 = await req.clone().json().catch(() => ({}));
        const tid = body2?.team_id;
        if (tid) {
          const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id: tid, user_email: user.email });
          const allowed = ['admin', 'kasserer'];
          if (!membership.length || !allowed.includes(membership[0].role)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
          }
        }
      }
    }

    const body = await req.json();

    const { order_id, payment_id, status } = body;

    if (!order_id && !payment_id) {
      return Response.json({ error: 'order_id eller payment_id er påkrevd' }, { status: 400 });
    }

    // Normalize status
    const isCompleted = ['AUTHORIZED', 'SALE', 'completed', 'CAPTURED'].includes(status);
    const isFailed = ['CANCELLED', 'REJECTED', 'failed', 'FAILED'].includes(status);

    if (!isCompleted && !isFailed) {
      return Response.json({ message: 'Ingen handling for status: ' + status });
    }

    // Find the payment record
    let payment;
    if (payment_id) {
      payment = await base44.asServiceRole.entities.Payment.get(payment_id);
    } else {
      const results = await base44.asServiceRole.entities.Payment.filter({ transaction_id: order_id });
      payment = results[0];
    }

    if (!payment) {
      return Response.json({ error: 'Betaling ikke funnet for order_id: ' + order_id }, { status: 404 });
    }

    if (payment.status === 'completed') {
      return Response.json({ message: 'Betaling allerede fullført', payment_id: payment.id });
    }

    if (isFailed) {
      await base44.asServiceRole.entities.Payment.update(payment.id, { status: 'failed' });
      return Response.json({ success: true, message: 'Betaling markert som feilet' });
    }

    // Mark payment completed
    await base44.asServiceRole.entities.Payment.update(payment.id, {
      status: 'completed',
      paid_at: new Date().toISOString(),
    });

    // Mark claim as paid
    if (payment.claim_id) {
      await base44.asServiceRole.entities.Claim.update(payment.claim_id, { status: 'paid' });
    }

    // Update player balance & payment status
    const player = await base44.asServiceRole.entities.Player.get(payment.player_id);
    if (player) {
      const newBalance = (player.balance || 0) - payment.amount;
      await base44.asServiceRole.entities.Player.update(player.id, {
        balance: newBalance,
        payment_status: newBalance <= 0 ? 'paid' : 'partial',
      });

      // Create income transaction for bookkeeping
      await base44.asServiceRole.entities.Transaction.create({
        team_id: payment.team_id,
        player_id: payment.player_id,
        type: 'income',
        category: 'Kontingent',
        amount: payment.amount,
        date: new Date().toISOString().split('T')[0],
        description: `Vipps-betaling mottatt – ${payment.transaction_id}`,
        status: 'active',
        reconciled: 'reconciled',
      });

      // Send confirmation email
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: player.user_email,
          subject: 'Betalingsbekreftelse mottatt',
          body: `Hei ${player.full_name},\n\nVi har mottatt din betaling på ${payment.amount} NOK via Vipps.\n\nReferanse: ${payment.transaction_id}\nDato: ${new Date().toLocaleDateString('nb-NO')}\n\nTakk for betalingen!\n\nMvh\nIdrettsØkonomi`,
        });
      } catch (emailErr) {
        console.warn('Bekreftelse e-post feilet:', emailErr.message);
      }
    }

    await base44.asServiceRole.entities.AuditLog.create({ team_id: payment.team_id, user_email: 'vipps-callback', action: 'approve', entity_type: 'Payment', entity_id: payment.id, description: `Vipps callback: betaling fullført – ${payment.transaction_id}`, timestamp: new Date().toISOString() }).catch(() => {});

    return Response.json({
      success: true,
      payment_id: payment.id,
      message: 'Betaling fullført og status oppdatert',
    });

  } catch (error) {
    console.error('vippsCallback feil:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});