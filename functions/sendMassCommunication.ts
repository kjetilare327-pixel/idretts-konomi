import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { communicationId } = await req.json();

    // Hent masseutsendelse
    const comm = await base44.asServiceRole.entities.MassCommunication.get(communicationId);
    
    if (!comm) {
      return Response.json({ error: 'Communication not found' }, { status: 404 });
    }

    // Hent segment og mottakere
    const segment = comm.segment_id 
      ? await base44.asServiceRole.entities.MemberSegment.get(comm.segment_id)
      : null;

    // Hent alle spillere for teamet
    const allPlayers = await base44.asServiceRole.entities.Player.filter({ 
      team_id: comm.team_id,
      status: 'active'
    });

    // Filtrer basert på segmentkriterier
    let recipients = allPlayers;
    
    if (segment?.criteria) {
      const criteria = segment.criteria;
      
      recipients = recipients.filter(player => {
        // Filter på rolle
        if (criteria.role && criteria.role !== 'all' && player.role !== criteria.role) {
          return false;
        }
        
        // Filter på betalingsstatus
        if (criteria.payment_status?.length > 0 && 
            !criteria.payment_status.includes(player.payment_status)) {
          return false;
        }
        
        // Filter på saldo
        if (criteria.balance_min !== undefined && player.balance < criteria.balance_min) {
          return false;
        }
        if (criteria.balance_max !== undefined && player.balance > criteria.balance_max) {
          return false;
        }
        
        return true;
      });
    }

    // Send meldinger
    let sentCount = 0;
    let failedCount = 0;

    for (const player of recipients) {
      try {
        if (comm.channel === 'email') {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: player.user_email,
            subject: comm.subject,
            body: comm.message.replace(/{{name}}/g, player.full_name)
          });
          sentCount++;
        } else if (comm.channel === 'sms') {
          // SMS ikke implementert ennå
          failedCount++;
        }
      } catch (error) {
        console.error(`Failed to send to ${player.user_email}:`, error);
        failedCount++;
      }
    }

    // Oppdater kommunikasjonsstatus
    await base44.asServiceRole.entities.MassCommunication.update(communicationId, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipient_count: recipients.length,
      sent_count: sentCount,
      failed_count: failedCount
    });

    return Response.json({
      success: true,
      recipients: recipients.length,
      sent: sentCount,
      failed: failedCount
    });

  } catch (error) {
    console.error('Error sending mass communication:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});