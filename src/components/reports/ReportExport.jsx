import React from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, FileText, FileSpreadsheet } from 'lucide-react';
import { formatNOK, formatDate } from '@/components/shared/FormatUtils';
import jsPDF from 'jspdf';

export default function ReportExport({ data, reportType, teamName, startDate, endDate, transactions, budgets }) {
  // Support being called from Reports page with transactions/budgets props
  const resolvedData = data || transactions || [];
  const resolvedType = reportType || 'transactions';
  const resolvedTeamName = teamName || 'Rapport';

  const exportToCSV = () => {
    let csv = '';
    
    if (reportType === 'budget_vs_actual') {
      csv = 'Kategori,Type,Budsjett,Faktisk,Avvik,Avvik %\n';
      data.forEach(row => {
        csv += `${row.category},${row.type === 'income' ? 'Inntekt' : 'Utgift'},${row.budgeted},${row.actual},${row.variance},${row.variancePercent.toFixed(1)}%\n`;
      });
    } else if (reportType === 'transactions') {
      csv = 'Dato,Kategori,Type,Beløp,Beskrivelse\n';
      data.forEach(row => {
        csv += `${row.date},${row.category},${row.type === 'income' ? 'Inntekt' : 'Utgift'},${row.amount},"${row.description || ''}"\n`;
      });
    } else if (reportType === 'cashflow') {
      csv = 'Måned,Inntekter,Utgifter,Netto,Saldo\n';
      data.forEach(row => {
        csv += `${row.month},${row.income},${row.expense},${row.net},${row.balance}\n`;
      });
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const safeText = (doc, text, x, y) => {
    const str = text == null ? '' : String(text);
    doc.text(str, x, y);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    safeText(doc, resolvedTeamName, 20, 20);

    doc.setFontSize(14);
    safeText(doc, getReportTitle(), 20, 30);

    doc.setFontSize(10);
    safeText(doc, `Generert: ${new Date().toLocaleDateString('nb-NO')}`, 20, 38);

    let y = 50;

    // Transactions mode (default when called from Reports page)
    const rows = resolvedData;
    doc.setFontSize(12);
    safeText(doc, 'Transaksjoner', 20, y);
    y += 10;

    doc.setFontSize(9);
    rows.forEach(row => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      safeText(doc, formatDate(row.date) || '', 20, y);
      safeText(doc, row.category || '', 55, y);
      safeText(doc, row.type === 'income' ? 'Inntekt' : 'Utgift', 100, y);
      safeText(doc, formatNOK(row.amount || 0), 140, y);
      y += 7;
    });

    doc.save(`rapport_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getReportTitle = () => {
    switch (resolvedType) {
      case 'budget_vs_actual': return 'Budsjett vs. Faktisk Rapport';
      case 'transactions': return 'Transaksjonsrapport';
      case 'cashflow': return 'Cashflow-prognose';
      default: return 'Finansrapport';
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={exportToPDF}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <FileText className="w-4 h-4" />
        Eksporter PDF
      </Button>
      <Button
        onClick={exportToCSV}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <FileSpreadsheet className="w-4 h-4" />
        Eksporter CSV
      </Button>
    </div>
  );
}