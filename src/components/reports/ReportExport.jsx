import React from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, FileText, FileSpreadsheet } from 'lucide-react';
import { formatNOK, formatDate } from '@/components/shared/FormatUtils';
import jsPDF from 'jspdf';

export default function ReportExport({ data, reportType, teamName, startDate, endDate }) {
  
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.text(teamName, 20, 20);
    
    doc.setFontSize(14);
    doc.text(getReportTitle(), 20, 30);
    
    doc.setFontSize(10);
    doc.text(`Periode: ${formatDate(startDate)} - ${formatDate(endDate)}`, 20, 38);
    doc.text(`Generert: ${new Date().toLocaleDateString('nb-NO')}`, 20, 44);
    
    let y = 55;
    
    if (reportType === 'budget_vs_actual') {
      doc.setFontSize(12);
      doc.text('Budsjett vs. Faktisk', 20, y);
      y += 10;
      
      doc.setFontSize(9);
      data.forEach(row => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        doc.text(`${row.category} (${row.type === 'income' ? 'Inntekt' : 'Utgift'})`, 20, y);
        doc.text(`Budsjett: ${formatNOK(row.budgeted)}`, 80, y);
        doc.text(`Faktisk: ${formatNOK(row.actual)}`, 130, y);
        doc.text(`Avvik: ${formatNOK(row.variance)} (${row.variancePercent.toFixed(1)}%)`, 170, y);
        y += 8;
      });
    } else if (reportType === 'transactions') {
      doc.setFontSize(12);
      doc.text('Transaksjoner', 20, y);
      y += 10;
      
      doc.setFontSize(9);
      data.forEach(row => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        doc.text(formatDate(row.date), 20, y);
        doc.text(row.category, 50, y);
        doc.text(row.type === 'income' ? 'Inn' : 'Ut', 90, y);
        doc.text(formatNOK(row.amount), 120, y);
        y += 7;
      });
    } else if (reportType === 'cashflow') {
      doc.setFontSize(12);
      doc.text('Cashflow-prognose', 20, y);
      y += 10;
      
      doc.setFontSize(9);
      data.forEach(row => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        doc.text(row.month, 20, y);
        doc.text(`Inn: ${formatNOK(row.income)}`, 60, y);
        doc.text(`Ut: ${formatNOK(row.expense)}`, 110, y);
        doc.text(`Saldo: ${formatNOK(row.balance)}`, 150, y);
        y += 7;
      });
    }
    
    doc.save(`${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getReportTitle = () => {
    switch (reportType) {
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