import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { referral_code, new_player_email, new_player_name } = await req.json();
    
    if (!referral_code || !new_player_email) {
      return Response.json({ 
        error: 'referral_code and new_player_email required' 
      }, { status: 400 });
    }

    // Find the player with this referral code
    const referrers = await base44.asServiceRole.entities.Player.filter({
      referral_code: referral_code,
      status: 'active'
    });

    if (referrers.length === 0) {
      return Response.json({ 
        error: 'Invalid referral code' 
      }, { status: 404 });
    }

    const referrer = referrers[0];

    // Create referral record
    const referral = await base44.asServiceRole.entities.Referral.create({
      team_id: referrer.team_id,
      referrer_player_id: referrer.id,
      referrer_name: referrer.full_name,
      referred_name: new_player_name,
      referral_code: referral_code,
      status: 'pending'
    });

    // Send notification to referrer
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: referrer.user_email,
      subject: 'Noen brukte din henvisningskode! 🎉',
      body: `Hei ${referrer.full_name},<br><br>
             Gratulerer! ${new_player_name || 'En ny person'} har brukt din henvisningskode.<br><br>
             Du vil motta din belønning når de fullfører sin første betaling.<br><br>
             Takk for at du hjelper laget å vokse!`
    });

    return Response.json({ 
      success: true,
      referral_id: referral.id,
      message: 'Referral processed successfully'
    });

  } catch (error) {
    console.error('Process referral error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});