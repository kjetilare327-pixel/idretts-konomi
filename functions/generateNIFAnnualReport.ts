import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, year } = await req.json();

    // Hent alle nødvendige data
    const [transactions, budgets, players, team] = await Promise.all([
      base44.asServiceRole.entities.Transaction.filter({ team_id: teamId }),
      base44.asServiceRole.entities.Budget.filter({ team_id: teamId }),
      base44.asServiceRole.entities.Player.filter({ team_id: teamId }),
      base44.asServiceRole.entities.Team.get(teamId)
    ]);

    // Filtrer transaksjoner for ønsket år
    const yearTransactions = transactions.filter(t => {
      if (!t.date) return false;
      return new Date(t.date).getFullYear() === parseInt(year);
    });

    // Beregn inntekter og utgifter per kategori
    const incomeByCategory = {};
    const expenseByCategory = {};
    let totalIncome = 0;
    let totalExpense = 0;

    yearTransactions.forEach(t => {
      if (t.type === 'income') {
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
        totalIncome += t.amount;
      } else {
        expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
        totalExpense += t.amount;
      }
    });

    const balance = totalIncome - totalExpense;

    // NIF-spesifikke kategorier
    const taxFreeIncome = 
      (incomeByCategory['Kontingent'] || 0) + 
      (incomeByCategory['Gaver'] || 0) + 
      (incomeByCategory['Dugnad'] || 0);
    
    const otherIncome = totalIncome - taxFreeIncome;

    // Opprett PDF
    const doc = new jsPDF();
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('ÅRSRAPPORT - NIF-KOMPATIBEL', 105, y, { align: 'center' });
    
    y += 10;
    doc.setFontSize(14);
    doc.text(team.name, 105, y, { align: 'center' });
    
    y += 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Regnskapsår: ${year}`, 105, y, { align: 'center' });
    
    if (team.nif_number) {
      y += 7;
      doc.text(`NIF-nummer: ${team.nif_number}`, 105, y, { align: 'center' });
    }
    
    y += 7;
    doc.text(`Idrettstype: ${team.sport_type}`, 105, y, { align: 'center' });
    
    y += 7;
    doc.text(`Antall medlemmer: ${players.filter(p => p.status === 'active').length}`, 105, y, { align: 'center' });
    
    y += 15;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(14);
    doc.text('RESULTATREGNSKAP', 20, y);
    
    y += 10;
    doc.setFontSize(11);
    
    // Inntekter
    doc.text('INNTEKTER', 20, y);
    y += 7;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    
    const incomeCategories = Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]);
    incomeCategories.forEach(([category, amount]) => {
      doc.text(`  ${category}`, 20, y);
      doc.text(formatNOK(amount), 190, y, { align: 'right' });
      y += 6;
    });
    
    y += 3;
    doc.setFont(undefined, 'bold');
    doc.text('Sum inntekter', 20, y);
    doc.text(formatNOK(totalIncome), 190, y, { align: 'right' });
    
    y += 10;
    
    // Utgifter
    doc.text('UTGIFTER', 20, y);
    y += 7;
    doc.setFont(undefined, 'normal');
    
    const expenseCategories = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
    expenseCategories.forEach(([category, amount]) => {
      doc.text(`  ${category}`, 20, y);
      doc.text(formatNOK(amount), 190, y, { align: 'right' });
      y += 6;
    });
    
    y += 3;
    doc.setFont(undefined, 'bold');
    doc.text('Sum utgifter', 20, y);
    doc.text(formatNOK(totalExpense), 190, y, { align: 'right' });
    
    y += 10;
    doc.setFontSize(12);
    doc.text('ÅRSRESULTAT', 20, y);
    doc.text(formatNOK(balance), 190, y, { align: 'right' });
    
    // Ny side for NIF-spesifikk informasjon
    doc.addPage();
    y = 20;
    
    doc.setFontSize(14);
    doc.text('NIF-SPESIFIKK INFORMASJON', 20, y);
    
    y += 10;
    doc.setFontSize(11);
    doc.text('Skattefrie inntekter (§ 6-7):', 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    doc.text('  Kontingenter', 30, y);
    doc.text(formatNOK(incomeByCategory['Kontingent'] || 0), 190, y, { align: 'right' });
    y += 6;
    
    doc.text('  Gaver/bidrag', 30, y);
    doc.text(formatNOK(incomeByCategory['Gaver'] || 0), 190, y, { align: 'right' });
    y += 6;
    
    doc.text('  Dugnadsinntekter', 30, y);
    doc.text(formatNOK(incomeByCategory['Dugnad'] || 0), 190, y, { align: 'right' });
    y += 6;
    
    doc.setFont(undefined, 'bold');
    doc.text('Sum skattefrie inntekter:', 30, y);
    doc.text(formatNOK(taxFreeIncome), 190, y, { align: 'right' });
    
    y += 10;
    doc.setFont(undefined, 'normal');
    doc.text('Øvrige skattepliktige inntekter:', 20, y);
    doc.text(formatNOK(otherIncome), 190, y, { align: 'right' });
    
    y += 15;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('MERVERDIAVGIFT (MVA):', 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Organisasjonen er fritatt for merverdiavgift jf. mval. § 3-1 første ledd c', 20, y);
    doc.text('(idrettsaktivitet er momsfritatt).', 20, y + 6);
    
    y += 20;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('ORGANISASJONSFORM:', 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Frivillig idrettsorganisasjon', 20, y);
    
    y += 10;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('REGNSKAPSSTANDARD:', 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Regnskapet er utarbeidet etter god regnskapsskikk for ideelle', 20, y);
    doc.text('organisasjoner.', 20, y + 6);
    
    // Budsjettsammenligning hvis tilgjengelig
    if (budgets.length > 0) {
      y += 20;
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('BUDSJETT VS. REGNSKAP', 20, y);
      
      y += 10;
      doc.setFontSize(10);
      doc.text('Kategori', 20, y);
      doc.text('Budsjett', 120, y, { align: 'right' });
      doc.text('Regnskap', 160, y, { align: 'right' });
      doc.text('Avvik', 190, y, { align: 'right' });
      y += 3;
      doc.line(20, y, 190, y);
      y += 5;
      
      doc.setFont(undefined, 'normal');
      budgets.forEach(b => {
        const budgeted = b.period === 'monthly' ? b.monthly_amount * 12 : b.yearly_amount;
        const actual = b.type === 'income' 
          ? (incomeByCategory[b.category] || 0)
          : (expenseByCategory[b.category] || 0);
        const variance = actual - budgeted;
        
        doc.text(b.category, 20, y);
        doc.text(formatNOK(budgeted), 120, y, { align: 'right' });
        doc.text(formatNOK(actual), 160, y, { align: 'right' });
        doc.text(formatNOK(variance), 190, y, { align: 'right' });
        y += 6;
        
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });
    }
    
    // Footer på siste side
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(`Generert: ${new Date().toLocaleDateString('nb-NO')}`, 20, 285);
      doc.text(`Side ${i} av ${pageCount}`, 190, 285, { align: 'right' });
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="arsrapport_${team.name}_${year}.pdf"`
      }
    });

  } catch (error) {
    console.error('Error generating NIF annual report:', error);
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