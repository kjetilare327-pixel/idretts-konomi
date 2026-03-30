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

    const claim = await base44.asServiceRole.entities.Claim.get(claim_id);
    if (!claim) return Response.json({ error: 'Claim not found' }, { status: 404 });

    // Require admin/kasserer OR the player themselves
    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id: claim.team_id, user_email: user.email.toLowerCase() });
      const isFinanceRole = membership.length && ['admin', 'kasserer'].includes(membership[0].role);
      const playerRecord = await base44.asServiceRole.entities.Player.filter({ team_id: claim.team_id, user_email: user.email.toLowerCase() }).catch(() => []);
      const isOwnClaim = playerRecord.length > 0 && claim.player_id === playerRecord[0].id;
      if (!isFinanceRole && !isOwnClaim) {
        return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
      }
    }

    const team = await base44.asServiceRole.entities.Team.get(claim.team_id);
    const player = await base44.asServiceRole.entities.Player.get(claim.player_id);

    // Generer KID-referanse hvis ikke finnes
    let kidReference = claim.kid_reference;
    if (!kidReference) {
      kidReference = `${team.id.slice(0, 6)}${claim.id.slice(0, 6)}${Date.now().toString().slice(-4)}`;
      await base44.asServiceRole.entities.Claim.update(claim_id, { kid_reference: kidReference });
    }

    const message = `${team.name} - ${claim.type} - ${player.full_name}`;
    const vippsLink = `https://qr.vipps.no/28/2/01/031/${team.name.replace(/\s/g, '')}?v=1&message=${encodeURIComponent(message)}&amount=${claim.amount}`;

    await base44.asServiceRole.entities.Claim.update(claim_id, { 
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