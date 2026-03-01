import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled invocations (no auth) OR authenticated admin/kasserer
    const isAuthenticated = await base44.auth.isAuthenticated().catch(() => false);
    if (isAuthenticated) {
      const user = await base44.auth.me().catch(() => null);
      if (user && user.role !== 'admin') {
        const { team_id } = await req.clone().json().catch(() => ({}));
        if (team_id) {
          const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id, user_email: user.email });
          const allowedRoles = ['admin', 'kasserer'];
          if (!membership.length || !allowedRoles.includes(membership[0].role)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
          }
        }
      }
    }

    // Hent alle forfalte krav
    const allClaims = await base44.asServiceRole.entities.Claim.list();
    const now = new Date();
    
    const overdueClaims = allClaims.filter(c => {
      if (c.status !== 'pending') return false;
      const dueDate = new Date(c.due_date);
      return dueDate < now;
    });

    // Oppdater status til overdue
    for (const claim of overdueClaims) {
      await base44.asServiceRole.entities.Claim.update(claim.id, {
        status: 'overdue'
      });
    }

    // Send purringer for krav som ikke har fått purring på 7 dager
    const claimsNeedingReminder = overdueClaims.filter(c => {
      if (!c.last_reminder_sent) return true;
      const lastReminder = new Date(c.last_reminder_sent);
      const daysSince = (now - lastReminder) / (1000 * 60 * 60 * 24);
      return daysSince >= 7;
    });

    let remindersSent = 0;

    for (const claim of claimsNeedingReminder) {
      try {
        // Hent spiller og lag-info
        const player = await base44.asServiceRole.entities.Player.get(claim.player_id);
        const team = await base44.asServiceRole.entities.Team.get(claim.team_id);

        if (!player?.user_email) continue;

        const daysOverdue = Math.floor((now - new Date(claim.due_date)) / (1000 * 60 * 60 * 24));
        
        // Generer Vipps-betalingslenke hvis den ikke finnes
        let vippsLink = claim.vipps_payment_link;
        if (!vippsLink) {
          try {
            const vippsResult = await base44.asServiceRole.functions.invoke('createVippsPayment', {
              amount: claim.amount,
              description: `${claim.type} - ${claim.description || ''}`,
              playerId: claim.player_id,
              claimId: claim.id,
              teamId: claim.team_id
            });
            vippsLink = vippsResult.data?.paymentLink;
            
            if (vippsLink) {
              await base44.asServiceRole.entities.Claim.update(claim.id, {
                vipps_payment_link: vippsLink
              });
            }
          } catch (e) {
            console.error('Failed to create Vipps link:', e);
          }
        }

        // Send purring-epost
        const subject = `Purring: Forfalt betaling - ${team.name}`;
        
        let body = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Betalingspåminnelse - Forfalt faktura</h2>
            
            <p>Hei ${player.full_name},</p>
            
            <p>Vi registrerer at følgende faktura ikke er betalt:</p>
            
            <div style="background-color: #fee; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
              <p><strong>Type:</strong> ${formatClaimType(claim.type)}</p>
              <p><strong>Beløp:</strong> ${formatNOK(claim.amount)}</p>
              <p><strong>Forfallsdato:</strong> ${new Date(claim.due_date).toLocaleDateString('nb-NO')}</p>
              <p><strong>Dager forfalt:</strong> ${daysOverdue}</p>
              ${claim.description ? `<p><strong>Beskrivelse:</strong> ${claim.description}</p>` : ''}
              ${claim.kid_reference ? `<p><strong>KID-nummer:</strong> ${claim.kid_reference}</p>` : ''}
            </div>
            
            <p><strong>Vennligst betal så snart som mulig.</strong></p>
        `;

        if (vippsLink) {
          body += `
            <div style="margin: 30px 0;">
              <a href="${vippsLink}" style="background-color: #ff5b24; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Betal med Vipps
              </a>
            </div>
          `;
        }

        body += `
            <p>Ved spørsmål, ta kontakt med laget.</p>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
              Med vennlig hilsen,<br>
              ${team.name}
            </p>
          </div>
        `;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: player.user_email,
          subject: subject,
          body: body
        });

        // Oppdater last_reminder_sent
        await base44.asServiceRole.entities.Claim.update(claim.id, {
          last_reminder_sent: now.toISOString()
        });

        remindersSent++;

      } catch (error) {
        console.error(`Failed to send reminder for claim ${claim.id}:`, error);
      }
    }

    return Response.json({
      success: true,
      overdueClaims: overdueClaims.length,
      remindersSent: remindersSent
    });

  } catch (error) {
    console.error('Error in sendPaymentReminders:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function formatNOK(amount) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatClaimType(type) {
  const types = {
    'kontingent': 'Medlemskontingent',
    'cup': 'Cup-deltakelse',
    'dugnad': 'Dugnadskrav',
    'utstyr': 'Utstyr',
    'annet': 'Annet'
  };
  return types[type] || type;
}