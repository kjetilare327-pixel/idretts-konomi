import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTeam } from '@/components/shared/TeamContext';
import { formatNOK, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/components/shared/FormatUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileDown, Mail, Loader2, FileSpreadsheet } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1'];
const MONTHS = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'];

export default function Reports() {
  const { currentTeam, user } = useTeam();
  const [period, setPeriod] = useState('year');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth()));
  const [sending, setSending] = useState(false);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      if (String(d.getFullYear()) !== year) return false;
      if (period === 'month' && String(d.getMonth()) !== month) return false;
      return true;
    });
  }, [transactions, period, year, month]);

  const summary = useMemo(() => {
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

    return { incomeByCategory, expenseByCategory, totalIncome, totalExpense, balance: totalIncome - totalExpense };
  }, [filtered]);

  const pieData = useMemo(() => {
    return Object.entries(summary.expenseByCategory).map(([name, value]) => ({ name, value }));
  }, [summary]);

  const periodLabel = period === 'year' ? year : `${MONTHS[Number(month)]} ${year}`;

  const generateReportText = () => {
    let text = `ØKONOMISK RAPPORT – ${currentTeam?.name}\n`;
    text += `Periode: ${periodLabel}\n`;
    text += `Generert: ${new Date().toLocaleDateString('nb-NO')}\n\n`;
    text += `═══════════════════════════════\n`;
    text += `SAMMENDRAG\n`;
    text += `═══════════════════════════════\n`;
    text += `Totale inntekter:  ${formatNOK(summary.totalIncome)}\n`;
    text += `Totale utgifter:   ${formatNOK(summary.totalExpense)}\n`;
    text += `Netto resultat:    ${formatNOK(summary.balance)}\n\n`;
    
    text += `INNTEKTER PER KATEGORI\n`;
    text += `───────────────────────\n`;
    INCOME_CATEGORIES.forEach(c => {
      const amt = summary.incomeByCategory[c] || 0;
      if (amt > 0) text += `  ${c}: ${formatNOK(amt)}\n`;
    });
    
    text += `\nUTGIFTER PER KATEGORI\n`;
    text += `───────────────────────\n`;
    EXPENSE_CATEGORIES.forEach(c => {
      const amt = summary.expenseByCategory[c] || 0;
      if (amt > 0) text += `  ${c}: ${formatNOK(amt)}\n`;
    });
    
    text += `\n═══════════════════════════════\n`;
    text += `NIF-KOMPATIBEL OPPSUMMERING\n`;
    text += `═══════════════════════════════\n`;
    text += `Skattefrie inntekter (kontingent, gaver, dugnad): ${formatNOK((summary.incomeByCategory['Kontingent'] || 0) + (summary.incomeByCategory['Gaver'] || 0) + (summary.incomeByCategory['Dugnad'] || 0))}\n`;
    text += `Øvrige inntekter: ${formatNOK(summary.totalIncome - (summary.incomeByCategory['Kontingent'] || 0) - (summary.incomeByCategory['Gaver'] || 0) - (summary.incomeByCategory['Dugnad'] || 0))}\n`;
    text += `Momsfritatt aktivitet (idrett): Ja\n`;
    
    return text;
  };

  const exportCSV = () => {
    let csv = 'Dato,Type,Kategori,Beløp,Beskrivelse\n';
    filtered.forEach(t => {
      csv += `${t.date},${t.type === 'income' ? 'Inntekt' : 'Utgift'},${t.category},${t.amount},"${t.description || ''}"\n`;
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${currentTeam?.name}_${periodLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportText = () => {
    const text = generateReportText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${currentTeam?.name}_${periodLabel}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendEmail = async () => {
    if (!user?.email) return;
    setSending(true);
    const report = generateReportText();
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `Økonomisk rapport – ${currentTeam?.name} – ${periodLabel}`,
      body: `<pre style="font-family: monospace; white-space: pre-wrap;">${report}</pre>`,
    });
    setSending(false);
    alert('Rapport sendt til ' + user.email);
  };

  if (!currentTeam) return <p className="text-center py-12 text-slate-500">Velg et lag for å se rapporter.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapporter</h1>
          <p className="text-sm text-slate-500">Generer og eksporter økonomiske rapporter</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> CSV
          </Button>
          <Button variant="outline" onClick={exportText} className="gap-2">
            <FileDown className="w-4 h-4" /> Tekstfil
          </Button>
          <Button variant="outline" onClick={sendEmail} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} E-post
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Periode</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Månedlig</SelectItem>
              <SelectItem value="year">Årlig</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">År</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {period === 'month' && (
          <div className="space-y-1">
            <Label className="text-xs">Måned</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-slate-500">Inntekter</p>
            <p className="text-2xl font-bold text-emerald-600">{formatNOK(summary.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-slate-500">Utgifter</p>
            <p className="text-2xl font-bold text-red-600">{formatNOK(summary.totalExpense)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-slate-500">Resultat</p>
            <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatNOK(summary.balance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader className="pb-2"><CardTitle className="text-base">Inntekter per kategori</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(summary.incomeByCategory).map(([name, value]) => ({ name, value }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => formatNOK(v)} />
                  <Bar dataKey="value" name="Beløp" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader className="pb-2"><CardTitle className="text-base">Utgiftsfordeling</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-64 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => formatNOK(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Ingen utgiftsdata</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader className="pb-2"><CardTitle className="text-base">Inntekter detaljer</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Kategori</TableHead><TableHead className="text-right">Beløp</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {INCOME_CATEGORIES.map(c => {
                  const amt = summary.incomeByCategory[c] || 0;
                  return amt > 0 ? <TableRow key={c}><TableCell>{c}</TableCell><TableCell className="text-right font-medium text-emerald-600">{formatNOK(amt)}</TableCell></TableRow> : null;
                })}
                <TableRow className="font-bold border-t-2">
                  <TableCell>Totalt</TableCell>
                  <TableCell className="text-right text-emerald-600">{formatNOK(summary.totalIncome)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader className="pb-2"><CardTitle className="text-base">Utgifter detaljer</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Kategori</TableHead><TableHead className="text-right">Beløp</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {EXPENSE_CATEGORIES.map(c => {
                  const amt = summary.expenseByCategory[c] || 0;
                  return amt > 0 ? <TableRow key={c}><TableCell>{c}</TableCell><TableCell className="text-right font-medium text-red-600">{formatNOK(amt)}</TableCell></TableRow> : null;
                })}
                <TableRow className="font-bold border-t-2">
                  <TableCell>Totalt</TableCell>
                  <TableCell className="text-right text-red-600">{formatNOK(summary.totalExpense)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* NIF summary */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader className="pb-2"><CardTitle className="text-base">NIF-kompatibel oppsummering</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2">Skattefrie inntekter</p>
              <p>Kontingent: {formatNOK(summary.incomeByCategory['Kontingent'] || 0)}</p>
              <p>Gaver: {formatNOK(summary.incomeByCategory['Gaver'] || 0)}</p>
              <p>Dugnad: {formatNOK(summary.incomeByCategory['Dugnad'] || 0)}</p>
              <p className="font-semibold mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-500/20">
                Sum: {formatNOK((summary.incomeByCategory['Kontingent'] || 0) + (summary.incomeByCategory['Gaver'] || 0) + (summary.incomeByCategory['Dugnad'] || 0))}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-500/10">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">Øvrige inntekter</p>
              <p>Sponsor: {formatNOK(summary.incomeByCategory['Sponsor'] || 0)}</p>
              <p>Kiosk: {formatNOK(summary.incomeByCategory['Kiosk'] || 0)}</p>
              <p className="font-semibold mt-2 pt-2 border-t border-blue-200 dark:border-blue-500/20">
                Sum: {formatNOK((summary.incomeByCategory['Sponsor'] || 0) + (summary.incomeByCategory['Kiosk'] || 0))}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">Momsfritak for idrettsaktivitet er forhåndsmerket.</p>
        </CardContent>
      </Card>
    </div>
  );
}