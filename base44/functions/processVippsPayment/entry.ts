import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { claim_id, player_id, team_id } = await req.json();

    if (!claim_id || !player_id || !team_id) {
      return Response.json({ error: 'claim_id, player_id, and team_id required' }, { status: 400 });
    }

    // Verify user role (kasserer or admin required, or the player themselves)
    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id, user_email: user.email });
      const allowedRoles = ['admin', 'kasserer'];
      const isMember = membership.length && allowedRoles.includes(membership[0].role);
      // Allow player to pay their own claim
      const isPlayerSelf = await base44.asServiceRole.entities.Player.filter({ team_id, id: player_id, user_email: user.email }).then(r => r.length > 0).catch(() => false);
      if (!isMember && !isPlayerSelf) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get claim details
    const claim = await base44.asServiceRole.entities.Claim.get(claim_id);
    if (!claim) {
      return Response.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Get player details
    const player = await base44.asServiceRole.entities.Player.get(player_id);
    if (!player) {
      return Response.json({ error: 'Player not found' }, { status: 404 });
    }

    // In a real implementation, you would integrate with Vipps API here
    // For now, we'll simulate the payment process
    
    // Create Vipps payment link (simulated)
    const vippsReference = `PAY-${Date.now()}-${claim_id.substring(0, 8)}`;
    const vippsLink = `https://vipps.no/payment/${vippsReference}`;

    // Update claim with Vipps link
    await base44.asServiceRole.entities.Claim.update(claim_id, {
      vipps_payment_link: vippsLink,
      kid_reference: vippsReference
    });

    // Create pending payment record
    const payment = await base44.asServiceRole.entities.Payment.create({
      team_id,
      player_id,
      claim_id,
      amount: claim.amount,
      payment_method: 'vipps',
      status: 'pending',
      transaction_id: vippsReference,
      vipps_payment_link: vippsLink
    });

    // Send email with payment link
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: player.user_email,
      subject: `Betalingslenke for: ${claim.description}`,
      body: `
        Hei ${player.full_name},

        Her er din betalingslenke for: ${claim.description}

        Beløp: ${claim.amount} NOK
        Forfallsdato: ${new Date(claim.due_date).toLocaleDateString('nb-NO')}

        Betal nå: ${vippsLink}

        Referanse: ${vippsReference}

        Med vennlig hilsen,
        IdrettsØkonomi
      `
    });

    await base44.asServiceRole.entities.AuditLog.create({ team_id, user_email: user.email.toLowerCase(), action: 'create', entity_type: 'Payment', entity_id: payment.id, description: `Vipps betaling opprettet for krav ${claim_id} – ${vippsReference}`, timestamp: new Date().toISOString() }).catch(() => {});

    return Response.json({
      success: true,
      payment_id: payment.id,
      vipps_link: vippsLink,
      reference: vippsReference,
      message: 'Payment link created and sent to player'
    });

  } catch (error) {
    console.error('Vipps payment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});