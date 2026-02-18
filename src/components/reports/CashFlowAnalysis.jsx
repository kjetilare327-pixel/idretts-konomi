import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown, AlertCircle, TrendingUp } from 'lucide-react';
import { formatNOK } from '../shared/FormatUtils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';

export default function CashFlowAnalysis({ transactions, claims, budgets, teamName }) {
  const { months, avgIncome, avgExpense } = useMemo(() => {
    const today = new Date();
    const histData = [];
    for (let i = 6; i > 0; i--) {
      const d = new Date(today); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const tx = transactions.filter(t => t.date?.startsWith(key));
      histData.push({
        income: tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      });
    }
    const avgIncome = histData.reduce((s, d) => s + d.income, 0) / 6;
    const avgExpense = histData.reduce((s, d) => s + d.expense, 0) / 6;
    const totalIn = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalOut = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    let runningBalance = totalIn - totalOut;

    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(today); d.setMonth(d.getMonth() + i);
      const budInc = budgets.filter(b => b.type === 'income').reduce((s, b) => s + (b.monthly_amount || 0), 0);
      const budExp = budgets.filter(b => b.type === 'expense').reduce((s, b) => s + (b.monthly_amount || 0), 0);
      const projIncome = budInc > 0 ? budInc : avgIncome;
      const projExpense = budExp > 0 ? budExp : avgExpense;
      const claimsIncome = claims
        .filter(c => c.due_date && c.status === 'pending' && new Date(c.due_date).getMonth() === d.getMonth() && new Date(c.due_date).getFullYear() === d.getFullYear())
        .reduce((s, c) => s + c.amount, 0);
      runningBalance += projIncome + claimsIncome - projExpense;
      months.push({
        month: d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' }),
        income: Math.round(projIncome + claimsIncome),
        expense: Math.round(projExpense),
        net: Math.round(projIncome + claimsIncome - projExpense),
        balance: Math.round(runningBalance),
        isCritical: runningBalance < 0,
      });
    }
    return { months, avgIncome, avgExpense };
  }, [transactions, claims, budgets]);

  const criticalMonths = months.filter(m => m.isCritical);

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 22;
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('Kontantstrømanalyse', pageW / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
    doc.text(`${teamName}  |  12-måneders prognose`, pageW / 2, y, { align: 'center' });
    doc.setTextColor(0); y += 14;

    doc.setFillColor(240, 249, 255);
    doc.rect(14, y - 5, pageW - 28, 9, 'F');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    ['Måned', 'Inntekter', 'Utgifter', 'Netto', 'Saldo'].forEach((h, i) => {
      doc.text(h, 16 + i * 36, y);
    });
    y += 10;

    months.forEach(m => {
      doc.setFont('helvetica', 'normal');
      if (m.isCritical) { doc.setFillColor(254, 226, 226); doc.rect(14, y - 5, pageW - 28, 8, 'F'); }
      const vals = [m.month, formatNOK(m.income), formatNOK(m.expense), formatNOK(m.net), formatNOK(m.balance)];
      vals.forEach((v, i) => { doc.setTextColor(i === 4 && m.balance < 0 ? 220 : 0, i === 4 && m.balance < 0 ? 30 : 0, 0); doc.text(v, 16 + i * 36, y); });
      doc.setTextColor(0);
      y += 8;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Gjennomsnitt per måned (historisk):', 14, y); y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text(`Inntekter: ${formatNOK(avgIncome)}  |  Utgifter: ${formatNOK(avgExpense)}  |  Netto: ${formatNOK(avgIncome - avgExpense)}`, 14, y);

    doc.save(`kontantstrom_${teamName}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-4">
      {criticalMonths.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">
            <span className="font-semibold">Advarsel:</span> Negativ saldo forventet i {criticalMonths.length} måned(er): {criticalMonths.slice(0, 3).map(m => m.month).join(', ')}{criticalMonths.length > 3 ? '...' : ''}
          </p>
        </div>
      )}

      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Kontantstrøm – 12-måneders prognose</CardTitle>
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={months}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => formatNOK(v)} />
                <Legend />
                <Area type="monotone" dataKey="income" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Inntekter" />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} name="Utgifter" />
                <Area type="monotone" dataKey="balance" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2} name="Saldo" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-xs text-slate-500">Snitt inntekter/mnd</p>
              <p className="font-bold text-emerald-600">{formatNOK(avgIncome)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Snitt utgifter/mnd</p>
              <p className="font-bold text-red-600">{formatNOK(avgExpense)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Forventet saldo (12 mnd)</p>
              <p className={`font-bold text-lg ${months[11]?.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatNOK(months[11]?.balance || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}