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

    const claim = await base44.entities.Claim.get(claim_id);
    const team = await base44.entities.Team.get(claim.team_id);
    const player = await base44.entities.Player.get(claim.player_id);

    // Generer KID-referanse hvis ikke finnes
    let kidReference = claim.kid_reference;
    if (!kidReference) {
      kidReference = `${team.id.slice(0, 6)}${claim.id.slice(0, 6)}${Date.now().toString().slice(-4)}`;
      await base44.entities.Claim.update(claim_id, { kid_reference: kidReference });
    }

    // Generer Vipps-betalingslenke
    // Format: vipps://&amount=BELØP&message=MELDING&recipientName=NAVN
    const message = `${team.name} - ${claim.type} - ${player.full_name}`;
    const vippsLink = `https://qr.vipps.no/28/2/01/031/${team.name.replace(/\s/g, '')}?v=1&message=${encodeURIComponent(message)}&amount=${claim.amount}`;

    // Oppdater claim med betalingslenke
    await base44.entities.Claim.update(claim_id, { 
      vipps_payment_link: vippsLink 
    });

    return Response.json({
      success: true,
      kid_reference: kidReference,
      vipps_link: vippsLink,
      bank_info: {
        recipient: team.name,
        amount: claim.amount,
        kid: kidReference,
        message: message
      }
    });

  } catch (error) {
    console.error('Error generating payment link:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});