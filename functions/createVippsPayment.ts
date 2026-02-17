import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { claim_id } = await req.json();
    
    if (!claim_id) {
      return Response.json({ error: 'claim_id is required' }, { status: 400 });
    }

    // Hent kravet
    const claim = await base44.entities.Claim.get(claim_id);
    const player = await base44.entities.Player.get(claim.player_id);
    
    // For demo: generer en mock Vipps betalingslenke
    // I produksjon: integrer med Vipps ePay API
    const mockOrderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const paymentLink = `https://vipps.no/pay?orderId=${mockOrderId}&amount=${claim.amount}`;
    
    // Opprett payment record
    const payment = await base44.asServiceRole.entities.Payment.create({
      team_id: claim.team_id,
      player_id: claim.player_id,
      claim_id: claim.id,
      amount: claim.amount,
      payment_method: 'vipps',
      status: 'pending',
      transaction_id: mockOrderId,
      vipps_payment_link: paymentLink
    });

    // Oppdater claim med betalingslenke
    await base44.asServiceRole.entities.Claim.update(claim_id, {
      vipps_payment_link: paymentLink
    });

    return Response.json({
      success: true,
      payment_id: payment.id,
      payment_link: paymentLink,
      message: 'Vipps betalingslenke opprettet'
    });

  } catch (error) {
    console.error('Error creating Vipps payment:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});