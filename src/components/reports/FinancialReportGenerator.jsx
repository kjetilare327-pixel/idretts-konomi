import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNOK } from '@/components/shared/FormatUtils';
import { FileText, Download, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';

const MONTHS = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'];

function getPeriodLabel(period, year, month, quarter) {
  if (period === 'month') return `${MONTHS[parseInt(month)]} ${year}`;
  if (period === 'quarter') return `Q${quarter} ${year}`;
  return `${year}`;
}

function filterByPeriod(transactions, period, year, month, quarter) {
  return transactions.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date);
    if (String(d.getFullYear()) !== year) return false;
    if (period === 'month' && String(d.getMonth()) !== month) return false;
    if (period === 'quarter') {
      const q = Math.floor(d.getMonth() / 3) + 1;
      if (String(q) !== quarter) return false;
    }
    return true;
  });
}

function DrillDownRow({ category, amount, transactions, type }) {
  const [expanded, setExpanded] = useState(false);
  const txns = transactions.filter(t => t.category === category && t.type === type);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
        onClick={() => setExpanded(e => !e)}
      >
        <TableCell className="font-medium">
          <span className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            {category}
          </span>
        </TableCell>
        <TableCell className="text-right">{txns.length} transaksjoner</TableCell>
        <TableCell className={`text-right font-semibold ${type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
          {formatNOK(amount)}
        </TableCell>
      </TableRow>
      {expanded && txns.map((tx, i) => (
        <TableRow key={tx.id || i} className="bg-slate-50/50 dark:bg-slate-800/50 text-xs">
          <TableCell className="pl-10 text-slate-500">{tx.date} – {tx.description || '(ingen beskrivelse)'}</TableCell>
          <TableCell />
          <TableCell className={`text-right ${type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatNOK(tx.amount)}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function PeriodComparison({ transactions, period, year, month, quarter }) {
  // Build the comparison period
  const current = filterByPeriod(transactions, period, year, month, quarter);

  let prevYear = String(parseInt(year) - 1);
  let prevMonth = month;
  let prevQuarter = quarter;
  if (period === 'month') {
    const m = parseInt(month);
    prevMonth = m === 0 ? '11' : String(m - 1);
    prevYear = m === 0 ? String(parseInt(year) - 1) : year;
  }
  if (period === 'quarter') {
    const q = parseInt(quarter);
    prevQuarter = q === 1 ? '4' : String(q - 1);
    prevYear = q === 1 ? String(parseInt(year) - 1) : year;
  }
  const previous = filterByPeriod(transactions, period, prevYear, prevMonth, prevQuarter);

  const curIncome = current.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const curExpense = current.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const prevIncome = previous.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const prevExpense = previous.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const incomeChange = curIncome - prevIncome;
  const expenseChange = curExpense - prevExpense;
  const netCur = curIncome - curExpense;
  const netPrev = prevIncome - prevExpense;

  const prevLabel = period === 'year'
    ? prevYear
    : period === 'quarter'
    ? `Q${prevQuarter} ${prevYear}`
    : `${MONTHS[parseInt(prevMonth)]} ${prevYear}`;

  const curLabel = getPeriodLabel(period, year, month, quarter);

  const rows = [
    { label: 'Inntekter', cur: curIncome, prev: prevIncome, change: incomeChange, positive: incomeChange > 0 },
    { label: 'Utgifter', cur: curExpense, prev: prevExpense, change: expenseChange, positive: expenseChange < 0 },
    { label: 'Netto resultat', cur: netCur, prev: netPrev, change: netCur - netPrev, positive: (netCur - netPrev) > 0, bold: true },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nøkkeltall</TableHead>
          <TableHead className="text-right">{prevLabel}</TableHead>
          <TableHead className="text-right">{curLabel}</TableHead>
          <TableHead className="text-right">Endring</TableHead>
          <TableHead className="text-right">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(r => (
          <TableRow key={r.label} className={r.bold ? 'font-bold border-t-2' : ''}>
            <TableCell>{r.label}</TableCell>
            <TableCell className="text-right">{formatNOK(r.prev)}</TableCell>
            <TableCell className="text-right">{formatNOK(r.cur)}</TableCell>
            <TableCell className={`text-right ${r.positive ? 'text-emerald-600' : 'text-red-600'}`}>
              <span className="flex items-center justify-end gap-1">
                {r.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {r.change >= 0 ? '+' : ''}{formatNOK(r.change)}
              </span>
            </TableCell>
            <TableCell className={`text-right text-sm ${r.positive ? 'text-emerald-600' : 'text-red-600'}`}>
              {r.prev !== 0 ? `${((r.change / Math.abs(r.prev)) * 100).toFixed(1)}%` : '–'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function FinancialReportGenerator({ transactions, budgets, teamName }) {
  const [period, setPeriod] = useState('month');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth()));
  const [quarter, setQuarter] = useState(String(Math.floor(new Date().getMonth() / 3) + 1));

  const filtered = useMemo(
    () => filterByPeriod(transactions, period, year, month, quarter),
    [transactions, period, year, month, quarter]
  );

  const summary = useMemo(() => {
    const inc = {}, exp = {};
    let totalIncome = 0, totalExpense = 0;
    filtered.forEach(t => {
      if (t.type === 'income') { inc[t.category] = (inc[t.category] || 0) + t.amount; totalIncome += t.amount; }
      else { exp[t.category] = (exp[t.category] || 0) + t.amount; totalExpense += t.amount; }
    });
    return { inc, exp, totalIncome, totalExpense, net: totalIncome - totalExpense };
  }, [filtered]);

  const periodLabel = getPeriodLabel(period, year, month, quarter);

  const exportCSV = () => {
    let csv = 'Dato,Type,Kategori,Beløp,Beskrivelse\n';
    filtered.forEach(t => {
      csv += `${t.date},${t.type === 'income' ? 'Inntekt' : 'Utgift'},${t.category},${t.amount},"${t.description || ''}"\n`;
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `rapport_${teamName}_${periodLabel}.csv` });
    a.click();
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            Dynamisk Finansrapport – {teamName}
          </CardTitle>
          <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> Eksporter CSV
          </Button>
        </div>

        {/* Period selectors */}
        <div className="flex flex-wrap gap-3 mt-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Månedlig</SelectItem>
              <SelectItem value="quarter">Kvartal</SelectItem>
              <SelectItem value="year">Årlig</SelectItem>
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {period === 'month' && (
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {period === 'quarter' && (
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['1', '2', '3', '4'].map(q => <SelectItem key={q} value={q}>Q{q}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
            <p className="text-xs text-slate-500">Inntekter</p>
            <p className="text-xl font-bold text-emerald-600">{formatNOK(summary.totalIncome)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-500/10">
            <p className="text-xs text-slate-500">Utgifter</p>
            <p className="text-xl font-bold text-red-600">{formatNOK(summary.totalExpense)}</p>
          </div>
          <div className={`text-center p-3 rounded-lg ${summary.net >= 0 ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
            <p className="text-xs text-slate-500">Netto</p>
            <p className={`text-xl font-bold ${summary.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatNOK(summary.net)}</p>
          </div>
        </div>

        <Tabs defaultValue="income-statement">
          <TabsList className="mb-4">
            <TabsTrigger value="income-statement">Resultatregnskap</TabsTrigger>
            <TabsTrigger value="comparison">Periodsammenligning</TabsTrigger>
          </TabsList>

          <TabsContent value="income-statement">
            <p className="text-xs text-slate-500 mb-3">Klikk på en kategori for å se underliggende transaksjoner</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Antall</TableHead>
                  <TableHead className="text-right">Beløp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10">
                  <TableCell colSpan={3} className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs uppercase tracking-wide">Inntekter</TableCell>
                </TableRow>
                {Object.entries(summary.inc).map(([cat, amt]) => (
                  <DrillDownRow key={cat} category={cat} amount={amt} transactions={filtered} type="income" />
                ))}
                <TableRow className="font-bold bg-emerald-50 dark:bg-emerald-900/10">
                  <TableCell>Sum inntekter</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-emerald-600">{formatNOK(summary.totalIncome)}</TableCell>
                </TableRow>

                <TableRow className="bg-red-50/50 dark:bg-red-900/10">
                  <TableCell colSpan={3} className="font-semibold text-red-700 dark:text-red-400 text-xs uppercase tracking-wide pt-4">Utgifter</TableCell>
                </TableRow>
                {Object.entries(summary.exp).map(([cat, amt]) => (
                  <DrillDownRow key={cat} category={cat} amount={amt} transactions={filtered} type="expense" />
                ))}
                <TableRow className="font-bold bg-red-50 dark:bg-red-900/10">
                  <TableCell>Sum utgifter</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-red-600">{formatNOK(summary.totalExpense)}</TableCell>
                </TableRow>

                <TableRow className="font-bold border-t-2 text-base">
                  <TableCell>Netto resultat</TableCell>
                  <TableCell />
                  <TableCell className={`text-right ${summary.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatNOK(summary.net)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="comparison">
            <p className="text-xs text-slate-500 mb-3">Sammenligner valgt periode mot forrige tilsvarende periode</p>
            <PeriodComparison
              transactions={transactions}
              period={period}
              year={year}
              month={month}
              quarter={quarter}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}