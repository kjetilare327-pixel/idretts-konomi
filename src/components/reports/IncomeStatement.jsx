import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { FileDown } from 'lucide-react';
import { formatNOK } from '../shared/FormatUtils';
import jsPDF from 'jspdf';

export default function IncomeStatement({ transactions, teamName }) {
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const filtered = useMemo(() => transactions.filter(t => {
    if (!t.date || t.status === 'annulled' || t.status === 'archived') return false;
    return t.date >= startDate && t.date <= endDate;
  }), [transactions, startDate, endDate]);

  const data = useMemo(() => {
    const incomeByCategory = {};
    const expenseByCategory = {};
    let totalIncome = 0, totalExpense = 0;
    filtered.forEach(t => {
      if (t.type === 'income') {
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
        totalIncome += t.amount;
      } else {
        expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
        totalExpense += t.amount;
      }
    });
    return { incomeByCategory, expenseByCategory, totalIncome, totalExpense, result: totalIncome - totalExpense };
  }, [filtered]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 22;

    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('Resultatregnskap', pageW / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`${teamName}  |  ${startDate} – ${endDate}`, pageW / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 14;

    const sectionHeader = (label, color) => {
      doc.setFillColor(...color);
      doc.rect(14, y - 5, pageW - 28, 9, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text(label, 16, y);
      y += 10;
    };

    const row = (label, amount, indent = false) => {
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(label, indent ? 22 : 16, y);
      doc.text(formatNOK(amount), pageW - 14, y, { align: 'right' });
      y += 7;
    };

    const totalRow = (label, amount) => {
      doc.line(14, y - 1, pageW - 14, y - 1);
      doc.setFont('helvetica', 'bold');
      row(label, amount);
      y += 2;
    };

    sectionHeader('INNTEKTER', [240, 253, 244]);
    Object.entries(data.incomeByCategory).forEach(([cat, amt]) => row(cat, amt, true));
    totalRow('Sum inntekter', data.totalIncome);

    y += 4;
    sectionHeader('UTGIFTER', [255, 245, 245]);
    Object.entries(data.expenseByCategory).forEach(([cat, amt]) => row(cat, amt, true));
    totalRow('Sum utgifter', data.totalExpense);

    y += 6;
    const color = data.result >= 0 ? [209, 250, 229] : [254, 226, 226];
    doc.setFillColor(...color);
    doc.rect(14, y - 5, pageW - 28, 10, 'F');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('ÅRSRESULTAT', 16, y);
    doc.text(formatNOK(data.result), pageW - 14, y, { align: 'right' });

    doc.save(`resultatregnskap_${teamName}_${startDate}_${endDate}.pdf`);
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base">Resultatregnskap</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fra dato</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Til dato</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36 text-sm" />
            </div>
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            <TableRow className="bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-50">
              <TableCell colSpan={2} className="font-bold text-emerald-700 dark:text-emerald-400 py-2 text-sm uppercase tracking-wide">Inntekter</TableCell>
            </TableRow>
            {Object.entries(data.incomeByCategory).map(([cat, amt]) => (
              <TableRow key={cat}>
                <TableCell className="pl-8">{cat}</TableCell>
                <TableCell className="text-right text-emerald-600">{formatNOK(amt)}</TableCell>
              </TableRow>
            ))}
            {Object.keys(data.incomeByCategory).length === 0 && (
              <TableRow><TableCell colSpan={2} className="pl-8 text-slate-400 text-sm">Ingen inntekter i perioden</TableCell></TableRow>
            )}
            <TableRow className="font-bold border-t-2 bg-emerald-50/50 dark:bg-emerald-950/10">
              <TableCell>Sum inntekter</TableCell>
              <TableCell className="text-right text-emerald-600">{formatNOK(data.totalIncome)}</TableCell>
            </TableRow>

            <TableRow><TableCell colSpan={2} className="h-4" /></TableRow>

            <TableRow className="bg-red-50 dark:bg-red-950/20 hover:bg-red-50">
              <TableCell colSpan={2} className="font-bold text-red-700 dark:text-red-400 py-2 text-sm uppercase tracking-wide">Utgifter</TableCell>
            </TableRow>
            {Object.entries(data.expenseByCategory).map(([cat, amt]) => (
              <TableRow key={cat}>
                <TableCell className="pl-8">{cat}</TableCell>
                <TableCell className="text-right text-red-600">{formatNOK(amt)}</TableCell>
              </TableRow>
            ))}
            {Object.keys(data.expenseByCategory).length === 0 && (
              <TableRow><TableCell colSpan={2} className="pl-8 text-slate-400 text-sm">Ingen utgifter i perioden</TableCell></TableRow>
            )}
            <TableRow className="font-bold border-t-2 bg-red-50/50 dark:bg-red-950/10">
              <TableCell>Sum utgifter</TableCell>
              <TableCell className="text-right text-red-600">{formatNOK(data.totalExpense)}</TableCell>
            </TableRow>

            <TableRow><TableCell colSpan={2} className="h-4" /></TableRow>

            <TableRow className={`font-bold text-base border-t-4 ${data.result >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <TableCell className="text-sm uppercase tracking-wide">Årsresultat</TableCell>
              <TableCell className={`text-right text-lg ${data.result >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatNOK(data.result)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}