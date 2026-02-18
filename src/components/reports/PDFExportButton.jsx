import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FileDown, FileSpreadsheet, FileText, Loader2, ChevronDown } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';
import { jsPDF } from 'jspdf';

export default function PDFExportButton({ transactions, budgets, claims, summary, teamName, periodLabel }) {
  const [loading, setLoading] = useState(null);

  const exportCSV = () => {
    setLoading('csv');
    let csv = '\uFEFFDato,Type,Kategori,Beløp,Beskrivelse\n';
    transactions.forEach(t => {
      const desc = (t.description || '').replace(/"/g, '""');
      csv += `${t.date},${t.type === 'income' ? 'Inntekt' : 'Utgift'},"${t.category}",${t.amount},"${desc}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaksjoner_${teamName}_${periodLabel}.csv`.replace(/\s/g, '_');
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setLoading(null), 500);
  };

  const exportBudgetCSV = () => {
    setLoading('budget-csv');
    let csv = '\uFEFFKategori,Type,Budsjett,Faktisk,Avvik\n';
    const catTotals = {};
    transactions.forEach(t => { catTotals[`${t.type}::${t.category}`] = (catTotals[`${t.type}::${t.category}`] || 0) + t.amount; });
    budgets.forEach(b => {
      const actual = catTotals[`${b.type}::${b.category}`] || 0;
      const budgeted = b.period === 'monthly' ? b.monthly_amount * 12 : (b.yearly_amount || b.monthly_amount * 12);
      csv += `"${b.category}",${b.type === 'income' ? 'Inntekt' : 'Utgift'},${budgeted},${actual},${actual - budgeted}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budsjett_${teamName}_${periodLabel}.csv`.replace(/\s/g, '_');
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setLoading(null), 500);
  };

  const exportPDF = () => {
    setLoading('pdf');
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 18;
      let y = 20;

      const line = () => { doc.setDrawColor(220, 220, 220); doc.line(margin, y, pageW - margin, y); y += 4; };
      const heading = (text, size = 14) => { doc.setFontSize(size); doc.setFont('helvetica', 'bold'); doc.text(text, margin, y); y += size * 0.5 + 3; };
      const body = (text, indent = 0) => { doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(text, margin + indent, y); y += 6; };
      const bodyRight = (label, value, color = null) => {
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(label, margin, y);
        if (color) doc.setTextColor(...color);
        doc.text(value, pageW - margin, y, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += 6;
      };

      // Header bar
      doc.setFillColor(16, 185, 129);
      doc.rect(0, 0, pageW, 14, 'F');
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text('IdrettsØkonomi', margin, 9);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text('Finansiell rapport', pageW - margin, 9, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y = 22;

      heading(`${teamName} – ${periodLabel}`, 16);
      body(`Generert: ${new Date().toLocaleDateString('nb-NO')}`);
      line(); y += 2;

      heading('SAMMENDRAG', 12);
      bodyRight('Totale inntekter', formatNOK(summary.totalIncome), [16, 185, 129]);
      bodyRight('Totale utgifter', formatNOK(summary.totalExpense), [239, 68, 68]);
      const balance = summary.totalIncome - summary.totalExpense;
      bodyRight('Netto resultat', formatNOK(balance), balance >= 0 ? [16, 185, 129] : [239, 68, 68]);
      const overdueSum = claims.filter(c => c.status === 'overdue').reduce((s, c) => s + c.amount, 0);
      if (overdueSum > 0) bodyRight('Forfalte krav', formatNOK(overdueSum), [239, 68, 68]);
      y += 4; line();

      // Income breakdown
      heading('INNTEKTER PER KATEGORI', 11);
      const incByCat = {};
      transactions.filter(t => t.type === 'income').forEach(t => { incByCat[t.category] = (incByCat[t.category] || 0) + t.amount; });
      Object.entries(incByCat).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
        bodyRight(cat, formatNOK(amt));
      });
      y += 2; line();

      // Expense breakdown
      heading('UTGIFTER PER KATEGORI', 11);
      const expByCat = {};
      transactions.filter(t => t.type === 'expense').forEach(t => { expByCat[t.category] = (expByCat[t.category] || 0) + t.amount; });
      Object.entries(expByCat).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
        if (y > 260) { doc.addPage(); y = 20; }
        bodyRight(cat, formatNOK(amt));
      });
      y += 2; line();

      // Claims summary
      if (claims.length > 0) {
        heading('FORDRINGER', 11);
        const pending = claims.filter(c => c.status === 'pending');
        const overdue = claims.filter(c => c.status === 'overdue');
        const paid = claims.filter(c => c.status === 'paid');
        bodyRight(`Ventende (${pending.length})`, formatNOK(pending.reduce((s,c)=>s+c.amount,0)));
        bodyRight(`Forfalt (${overdue.length})`, formatNOK(overdue.reduce((s,c)=>s+c.amount,0)), [239,68,68]);
        bodyRight(`Betalt (${paid.length})`, formatNOK(paid.reduce((s,c)=>s+c.amount,0)), [16,185,129]);
        y += 2; line();
      }

      // Budget comparison
      if (budgets.length > 0) {
        if (y > 220) { doc.addPage(); y = 20; }
        heading('BUDSJETT VS. FAKTISK', 11);
        const catTotals = {};
        transactions.forEach(t => { catTotals[`${t.type}::${t.category}`] = (catTotals[`${t.type}::${t.category}`] || 0) + t.amount; });
        budgets.slice(0, 12).forEach(b => {
          if (y > 270) { doc.addPage(); y = 20; }
          const actual = catTotals[`${b.type}::${b.category}`] || 0;
          const budgeted = b.period === 'monthly' ? b.monthly_amount * 12 : (b.yearly_amount || b.monthly_amount * 12);
          const diff = actual - budgeted;
          const diffColor = diff >= 0 ? [16,185,129] : [239,68,68];
          doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(0,0,0);
          doc.text(b.category, margin, y);
          doc.text(`Budsjett: ${formatNOK(budgeted)}`, margin + 60, y);
          doc.text(`Faktisk: ${formatNOK(actual)}`, margin + 105, y);
          doc.setTextColor(...diffColor);
          doc.text(`${diff >= 0 ? '+' : ''}${formatNOK(diff)}`, pageW - margin, y, { align: 'right' });
          doc.setTextColor(0,0,0);
          y += 6;
        });
        y += 2; line();
      }

      // Footer
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(150, 150, 150);
      doc.text('Generert av IdrettsØkonomi • Konfidensielt', margin, doc.internal.pageSize.getHeight() - 10);

      doc.save(`rapport_${teamName}_${periodLabel}.pdf`.replace(/\s/g, '_'));
    } catch (e) {
      alert('PDF-feil: ' + e.message);
    } finally {
      setTimeout(() => setLoading(null), 500);
    }
  };

  const exportClaimsCSV = () => {
    setLoading('claims-csv');
    let csv = '\uFEFFKrav-ID,Beløp,Type,Status,Forfallsdato\n';
    claims.forEach(c => {
      csv += `${c.id},${c.amount},"${c.type}","${c.status}","${c.due_date || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `krav_${teamName}_${periodLabel}.csv`.replace(/\s/g, '_');
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setLoading(null), 500);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={!!loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Eksporter
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={exportPDF} className="gap-2">
          <FileText className="w-4 h-4 text-red-500" />
          PDF-rapport (full)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportCSV} className="gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          CSV – Transaksjoner
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportBudgetCSV} className="gap-2">
          <FileSpreadsheet className="w-4 h-4 text-blue-500" />
          CSV – Budsjett vs. faktisk
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportClaimsCSV} className="gap-2">
          <FileSpreadsheet className="w-4 h-4 text-amber-500" />
          CSV – Fordringer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}