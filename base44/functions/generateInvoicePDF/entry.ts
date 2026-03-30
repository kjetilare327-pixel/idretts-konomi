import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { claim_id } = await req.json();
    if (!claim_id) return Response.json({ error: 'claim_id is required' }, { status: 400 });

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

    const player = await base44.asServiceRole.entities.Player.get(claim.player_id);
    const team = await base44.asServiceRole.entities.Team.get(claim.team_id);

    if (!claim.vipps_payment_link || !claim.kid_reference) {
      const linkResponse = await base44.functions.invoke('generatePaymentLink', { claim_id });
      claim.kid_reference = linkResponse.data.kid_reference;
      claim.vipps_payment_link = linkResponse.data.vipps_link;
    }

    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text(team.name, 20, 20);
    doc.setFontSize(12);
    doc.text('FAKTURA', 20, 35);

    doc.setFontSize(10);
    const today = new Date().toLocaleDateString('nb-NO');
    doc.text(`Dato: ${today}`, 20, 45);
    doc.text(`Forfallsdato: ${new Date(claim.due_date).toLocaleDateString('nb-NO')}`, 20, 52);
    if (claim.kid_reference) doc.text(`KID-nummer: ${claim.kid_reference}`, 20, 59);

    doc.setFontSize(12);
    doc.text('Til:', 20, 75);
    doc.setFontSize(10);
    doc.text(player.full_name, 20, 82);
    doc.text(player.user_email, 20, 89);

    doc.setFontSize(11);
    doc.text('Beskrivelse', 20, 110);
    doc.text('Beløp', 150, 110);
    doc.line(20, 113, 190, 113);

    doc.setFontSize(10);
    const typeLabel = {
      kontingent: 'Kontingent', cup: 'Cupavgift', dugnad: 'Dugnadsinnsats',
      utstyr: 'Utstyr', annet: claim.description || 'Betaling'
    }[claim.type];

    doc.text(typeLabel, 20, 122);
    doc.text(`${claim.amount} kr`, 150, 122);

    if (claim.description && claim.type !== 'annet') {
      doc.setFontSize(9);
      doc.text(claim.description, 20, 129);
    }

    doc.line(20, 135, 190, 135);
    doc.setFontSize(12);
    doc.text('Totalt å betale:', 20, 145);
    doc.text(`${claim.amount} kr`, 150, 145);

    doc.setFontSize(10);
    doc.text('Betalingsinformasjon:', 20, 160);
    doc.setFontSize(9);

    if (claim.vipps_payment_link) {
      doc.text('Betal med Vipps:', 20, 168);
      doc.setTextColor(0, 102, 204);
      doc.textWithLink('Klikk her for å betale', 20, 175, { url: claim.vipps_payment_link });
      doc.setTextColor(0, 0, 0);
    }

    doc.text('Eller betal til bankkonto med KID:', 20, 185);
    doc.text(`KID-nummer: ${claim.kid_reference}`, 20, 192);
    doc.text(`Mottaker: ${team.name}`, 20, 199);

    doc.setFontSize(8);
    doc.text('Vennligst betal innen forfallsdato.', 20, 215);
    doc.text(`Ved spørsmål, kontakt ${team.name}`, 20, 222);

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=faktura_${player.full_name.replace(/\s/g, '_')}_${today.replace(/\./g, '-')}.pdf`
      }
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});