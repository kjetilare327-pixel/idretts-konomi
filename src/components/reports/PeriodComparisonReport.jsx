import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNOK } from '@/components/shared/FormatUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, ChevronRight, ChevronDown } from 'lucide-react';

const MONTHS = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'];

function getTransactionsForPeriod(transactions, type, year, month) {
  return transactions.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date);
    if (String(d.getFullYear()) !== String(year)) return false;
    if (type === 'month' && String(d.getMonth()) !== String(month)) return false;
    return true;
  });
}

function summarize(txs) {
  const income = {}, expense = {};
  let totalIn = 0, totalEx = 0;
  txs.forEach(t => {
    if (t.type === 'income') { income[t.category] = (income[t.category] || 0) + t.amount; totalIn += t.amount; }
    else { expense[t.category] = (expense[t.category] || 0) + t.amount; totalEx += t.amount; }
  });
  return { income, expense, totalIn, totalEx, net: totalIn - totalEx };
}

export default function PeriodComparisonReport({ transactions = [] }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [periodType, setPeriodType] = useState('month');
  const [periodA, setPeriodA] = useState({ year: String(currentYear), month: String(currentMonth > 0 ? currentMonth - 1 : 11) });
  const [periodB, setPeriodB] = useState({ year: String(currentYear), month: String(currentMonth) });
  const [drillCategory, setDrillCategory] = useState(null);

  const txA = useMemo(() => getTransactionsForPeriod(transactions, periodType, periodA.year, periodA.month), [transactions, periodType, periodA]);
  const txB = useMemo(() => getTransactionsForPeriod(transactions, periodType, periodB.year, periodB.month), [transactions, periodType, periodB]);

  const sumA = useMemo(() => summarize(txA), [txA]);
  const sumB = useMemo(() => summarize(txB), [txB]);

  const labelA = periodType === 'year' ? periodA.year : `${MONTHS[Number(periodA.month)]} ${periodA.year}`;
  const labelB = periodType === 'year' ? periodB.year : `${MONTHS[Number(periodB.month)]} ${periodB.year}`;

  const allCategories = useMemo(() => {
    const cats = new Set([...Object.keys(sumA.income), ...Object.keys(sumB.income), ...Object.keys(sumA.expense), ...Object.keys(sumB.expense)]);
    return Array.from(cats);
  }, [sumA, sumB]);

  const chartData = [
    { name: 'Inntekter', [labelA]: sumA.totalIn, [labelB]: sumB.totalIn },
    { name: 'Utgifter', [labelA]: sumA.totalEx, [labelB]: sumB.totalEx },
    { name: 'Netto', [labelA]: sumA.net, [labelB]: sumB.net },
  ];

  const categoryRows = allCategories.map(cat => {
    const aInc = sumA.income[cat] || 0;
    const bInc = sumB.income[cat] || 0;
    const aExp = sumA.expense[cat] || 0;
    const bExp = sumB.expense[cat] || 0;
    const aTotal = aInc - aExp;
    const bTotal = bInc - bExp;
    const diff = bTotal - aTotal;
    const pct = aTotal !== 0 ? ((diff / Math.abs(aTotal)) * 100) : null;
    const isIncome = aInc > 0 || bInc > 0;
    return { cat, aTotal: isIncome ? aInc || aExp : aExp || aInc, bTotal: isIncome ? bInc || bExp : bExp || bInc, diff, pct, isIncome, txB: txB.filter(t => t.category === cat) };
  }).filter(r => r.aTotal !== 0 || r.bTotal !== 0);

  const drillTxs = drillCategory ? txB.filter(t => t.category === drillCategory) : [];

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Periodesammenligning</CardTitle>
        <p className="text-xs text-slate-500">Sammenlign økonomiske resultater mellom to perioder med drill-down til underliggende transaksjoner</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Period selectors */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={periodType} onValueChange={setPeriodType}>
              <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Månedlig</SelectItem>
                <SelectItem value="year">Årlig</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 items-end p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10">
            <div className="space-y-1">
              <Label className="text-xs text-blue-700 dark:text-blue-400">Periode A – År</Label>
              <Select value={periodA.year} onValueChange={v => setPeriodA({ ...periodA, year: v })}>
                <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {periodType === 'month' && (
              <div className="space-y-1">
                <Label className="text-xs text-blue-700 dark:text-blue-400">Måned</Label>
                <Select value={periodA.month} onValueChange={v => setPeriodA({ ...periodA, month: v })}>
                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex gap-2 items-end p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
            <div className="space-y-1">
              <Label className="text-xs text-emerald-700 dark:text-emerald-400">Periode B – År</Label>
              <Select value={periodB.year} onValueChange={v => setPeriodB({ ...periodB, year: v })}>
                <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {periodType === 'month' && (
              <div className="space-y-1">
                <Label className="text-xs text-emerald-700 dark:text-emerald-400">Måned</Label>
                <Select value={periodB.month} onValueChange={v => setPeriodB({ ...periodB, month: v })}>
                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Inntekter', a: sumA.totalIn, b: sumB.totalIn, color: 'emerald' },
            { label: 'Utgifter', a: sumA.totalEx, b: sumB.totalEx, color: 'red' },
            { label: 'Netto', a: sumA.net, b: sumB.net, color: 'blue' },
          ].map(item => {
            const diff = item.b - item.a;
            return (
              <div key={item.label} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-slate-400">{labelA}</p>
                    <p className="font-bold text-sm">{formatNOK(item.a)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">{labelB}</p>
                    <p className="font-bold text-sm">{formatNOK(item.b)}</p>
                  </div>
                </div>
                <div className={`mt-1.5 text-xs font-medium flex items-center gap-1 ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {diff >= 0 ? '+' : ''}{formatNOK(diff)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bar chart */}
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => formatNOK(v)} />
              <Legend />
              <Bar dataKey={labelA} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey={labelB} fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category drill-down table */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Kategoridetaljer – klikk for drill-down til transaksjoner</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">{labelA}</TableHead>
                <TableHead className="text-right">{labelB}</TableHead>
                <TableHead className="text-right">Endring</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryRows.map(row => (
                <React.Fragment key={row.cat}>
                  <TableRow
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => setDrillCategory(drillCategory === row.cat ? null : row.cat)}
                  >
                    <TableCell className="font-medium text-sm">{row.cat}</TableCell>
                    <TableCell className="text-right text-sm">{formatNOK(row.aTotal)}</TableCell>
                    <TableCell className="text-right text-sm">{formatNOK(row.bTotal)}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${row.diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {row.diff >= 0 ? '+' : ''}{formatNOK(row.diff)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.pct !== null ? (
                        <Badge variant="outline" className={`text-xs ${row.diff >= 0 ? 'text-emerald-600 border-emerald-200' : 'text-red-600 border-red-200'}`}>
                          {row.diff >= 0 ? '+' : ''}{row.pct.toFixed(1)}%
                        </Badge>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </TableCell>
                    <TableCell>
                      {drillCategory === row.cat ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </TableCell>
                  </TableRow>
                  {drillCategory === row.cat && drillTxs.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-slate-50 dark:bg-slate-800/50 p-0">
                        <div className="px-4 py-2 space-y-1">
                          <p className="text-xs font-semibold text-slate-500 mb-2">Transaksjoner i {labelB} – {row.cat}</p>
                          {drillTxs.map(t => (
                            <div key={t.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 dark:border-slate-700 last:border-0">
                              <span className="text-slate-600 dark:text-slate-400">{t.date} – {t.description || t.category}</span>
                              <span className={`font-medium ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {t.type === 'income' ? '+' : '-'}{formatNOK(t.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {drillCategory === row.cat && drillTxs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-400 text-center py-2">
                        Ingen transaksjoner for {row.cat} i {labelB}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}