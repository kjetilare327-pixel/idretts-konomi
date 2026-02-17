import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

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

    // Hent krav, spiller og lag
    const claim = await base44.entities.Claim.get(claim_id);
    const player = await base44.entities.Player.get(claim.player_id);
    const team = await base44.entities.Team.get(claim.team_id);

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text(team.name, 20, 20);
    
    doc.setFontSize(12);
    doc.text('FAKTURA', 20, 35);
    
    // Faktura info
    doc.setFontSize(10);
    const today = new Date().toLocaleDateString('nb-NO');
    doc.text(`Dato: ${today}`, 20, 45);
    doc.text(`Forfallsdato: ${new Date(claim.due_date).toLocaleDateString('nb-NO')}`, 20, 52);
    if (claim.kid_reference) {
      doc.text(`KID-nummer: ${claim.kid_reference}`, 20, 59);
    }
    
    // Kunde
    doc.setFontSize(12);
    doc.text('Til:', 20, 75);
    doc.setFontSize(10);
    doc.text(player.full_name, 20, 82);
    doc.text(player.user_email, 20, 89);
    
    // Tabell header
    doc.setFontSize(11);
    doc.text('Beskrivelse', 20, 110);
    doc.text('Beløp', 150, 110);
    doc.line(20, 113, 190, 113);
    
    // Innhold
    doc.setFontSize(10);
    const typeLabel = {
      kontingent: 'Kontingent',
      cup: 'Cupavgift',
      dugnad: 'Dugnadsinnsats',
      utstyr: 'Utstyr',
      annet: claim.description || 'Betaling'
    }[claim.type];
    
    doc.text(typeLabel, 20, 122);
    doc.text(`${claim.amount} kr`, 150, 122);
    
    if (claim.description && claim.type !== 'annet') {
      doc.setFontSize(9);
      doc.text(claim.description, 20, 129);
    }
    
    // Total
    doc.line(20, 135, 190, 135);
    doc.setFontSize(12);
    doc.text('Totalt å betale:', 20, 145);
    doc.text(`${claim.amount} kr`, 150, 145);
    
    // Footer
    doc.setFontSize(9);
    doc.text('Vennligst betal innen forfallsdato.', 20, 165);
    doc.text(`Ved spørsmål, kontakt ${team.name}`, 20, 172);
    
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
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});