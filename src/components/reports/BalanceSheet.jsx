import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { FileDown } from 'lucide-react';
import { formatNOK } from '../shared/FormatUtils';
import jsPDF from 'jspdf';

export default function BalanceSheet({ transactions, claims, teamName }) {
  const data = useMemo(() => {
    const activeTransactions = transactions.filter(t => t.status !== 'annulled' && t.status !== 'archived');
    const totalIncome = activeTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = activeTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const bankBalance = totalIncome - totalExpense;

    const pendingClaims = claims.filter(c => c.status === 'pending' || c.status === 'overdue');
    const receivables = pendingClaims.reduce((s, c) => s + c.amount, 0);
    const overdueClaims = claims.filter(c => c.status === 'overdue').reduce((s, c) => s + c.amount, 0);

    const totalAssets = bankBalance + receivables;
    const totalLiabilities = overdueClaims; // simplified
    const equity = totalAssets - totalLiabilities;

    return { bankBalance, receivables, overdueClaims, totalAssets, totalLiabilities, equity };
  }, [transactions, claims]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 22;

    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('Balanserapport', pageW / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`${teamName}  |  Per ${new Date().toLocaleDateString('nb-NO')}`, pageW / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 14;

    const section = (title, color) => {
      doc.setFillColor(...color);
      doc.rect(14, y - 5, pageW - 28, 9, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text(title, 16, y); y += 10;
    };
    const row = (label, amount, bold = false, indent = true) => {
      doc.setFontSize(10); doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(label, indent ? 22 : 16, y);
      doc.text(formatNOK(amount), pageW - 14, y, { align: 'right' });
      y += 7;
    };

    section('EIENDELER', [240, 249, 255]);
    row('Bankinnskudd (netto)', data.bankBalance);
    row('Utestående fordringer', data.receivables);
    doc.line(14, y - 1, pageW - 14, y - 1);
    row('Sum eiendeler', data.totalAssets, true, false);

    y += 6;
    section('GJELD', [255, 247, 237]);
    row('Forfalt gjeld', data.overdueClaims);
    doc.line(14, y - 1, pageW - 14, y - 1);
    row('Sum gjeld', data.totalLiabilities, true, false);

    y += 6;
    doc.setFillColor(240, 253, 244);
    doc.rect(14, y - 5, pageW - 28, 9, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('EGENKAPITAL', 16, y); y += 10;
    row('Opptjent egenkapital', data.equity, true);

    y += 6;
    doc.setFillColor(249, 250, 251);
    doc.rect(14, y - 5, pageW - 28, 10, 'F');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Sum gjeld og egenkapital', 16, y);
    doc.text(formatNOK(data.totalLiabilities + data.equity), pageW - 14, y, { align: 'right' });

    doc.save(`balanserapport_${teamName}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const Section = ({ title, className, children }) => (
    <>
      <TableRow className={`hover:${className} ${className}`}>
        <TableCell colSpan={2} className="font-bold text-sm uppercase tracking-wide py-2">{title}</TableCell>
      </TableRow>
      {children}
    </>
  );

  const TotalRow = ({ label, amount, bold = true, highlight = '' }) => (
    <TableRow className={`border-t-2 font-bold ${highlight}`}>
      <TableCell className={bold ? 'font-bold' : ''}>{label}</TableCell>
      <TableCell className={`text-right ${bold ? 'font-bold' : ''}`}>{formatNOK(amount)}</TableCell>
    </TableRow>
  );

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Balanserapport</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Per {new Date().toLocaleDateString('nb-NO')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
            <FileDown className="w-4 h-4" /> PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Eiendeler</h3>
            <Table>
              <TableBody>
                <Section title="Omløpsmidler" className="bg-blue-50 dark:bg-blue-950/20">
                  <TableRow>
                    <TableCell className="pl-8">Bankinnskudd (netto)</TableCell>
                    <TableCell className="text-right">{formatNOK(data.bankBalance)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Utestående fordringer</TableCell>
                    <TableCell className="text-right">{formatNOK(data.receivables)}</TableCell>
                  </TableRow>
                </Section>
                <TotalRow label="Sum eiendeler" amount={data.totalAssets} highlight="bg-blue-50/50 dark:bg-blue-950/10" />
              </TableBody>
            </Table>
          </div>

          {/* Liabilities + Equity */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Gjeld og egenkapital</h3>
            <Table>
              <TableBody>
                <Section title="Kortsiktig gjeld" className="bg-orange-50 dark:bg-orange-950/20">
                  <TableRow>
                    <TableCell className="pl-8">Forfalt gjeld</TableCell>
                    <TableCell className="text-right">{formatNOK(data.overdueClaims)}</TableCell>
                  </TableRow>
                </Section>
                <TotalRow label="Sum gjeld" amount={data.totalLiabilities} />

                <TableRow><TableCell colSpan={2} className="h-3" /></TableRow>

                <Section title="Egenkapital" className="bg-emerald-50 dark:bg-emerald-950/20">
                  <TableRow>
                    <TableCell className="pl-8">Opptjent egenkapital</TableCell>
                    <TableCell className={`text-right ${data.equity >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatNOK(data.equity)}
                    </TableCell>
                  </TableRow>
                </Section>
                <TotalRow label="Sum gjeld og egenkapital" amount={data.totalLiabilities + data.equity}
                  highlight="bg-slate-50 dark:bg-slate-800/50" />
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="mt-6 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs text-slate-500">
          * Forenklet balanserapport basert på registrerte transaksjoner og krav. Bankinnskudd = sum inntekter – sum utgifter (alle perioder).
        </div>
      </CardContent>
    </Card>
  );
}