import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTeam } from '@/components/shared/TeamContext';
import { formatNOK } from '@/components/shared/FormatUtils';
import { useLedger } from '@/components/shared/useLedger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Mail, Loader2, FileDown, Lock
} from 'lucide-react';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des'];
const CACHE = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 };

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-slate-500 text-sm max-w-xs">{message}</p>
    </div>
  );
}

function KpiCard({ title, value, subtitle, icon: Icon, color = 'slate' }) {
  const colorMap = {
    red: 'text-red-600',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    slate: 'text-slate-700 dark:text-slate-200',
  };
  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardContent className="p-5 flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {Icon && <Icon className={`w-8 h-8 opacity-15 ${colorMap[color]}`} />}
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { currentTeam, user } = useTeam();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [sending, setSending] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
    ...CACHE,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims', currentTeam?.id],
    queryFn: () => base44.entities.Claim.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
    ...CACHE,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', currentTeam?.id],
    queryFn: () => base44.entities.Player.filter({ team_id: currentTeam.id, status: 'active' }),
    enabled: !!currentTeam,
    ...CACHE,
  });

  const { ledgerMap } = useLedger(currentTeam?.id);

  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const stats = useMemo(() => {
    const monthIncome = transactions.filter(t => t.type === 'income' && t.date?.startsWith(curMonth)).reduce((s, t) => s + t.amount, 0);
    const monthExpense = transactions.filter(t => t.type === 'expense' && t.date?.startsWith(curMonth)).reduce((s, t) => s + t.amount, 0);
    const outstanding = Object.values(ledgerMap).reduce((s, l) => s + (l.balance > 0 ? l.balance : 0), 0);
    return { monthIncome, monthExpense, outstanding };
  }, [transactions, ledgerMap, curMonth]);

  // Monthly trend for selected year (12 months)
  const monthlyTrend = useMemo(() => {
    const grid = Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS_SHORT[i],
      income: 0,
      expense: 0,
    }));
    transactions.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (String(d.getFullYear()) !== year) return;
      const idx = d.getMonth();
      if (t.type === 'income') grid[idx].income += t.amount;
      else grid[idx].expense += t.amount;
    });
    return grid;
  }, [transactions, year]);

  const hasTransactions = transactions.some(t => String(new Date(t.date).getFullYear()) === year);

  // Overdue / outstanding claims table
  const overdueRows = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return claims
      .filter(c => c.status !== 'paid' && c.status !== 'cancelled')
      .map(c => {
        const player = players.find(p => p.id === c.player_id);
        const isOverdue = c.due_date && new Date(c.due_date) < today;
        return { ...c, playerName: player?.full_name || '–', isOverdue };
      })
      .sort((a, b) => (b.isOverdue ? 1 : 0) - (a.isOverdue ? 1 : 0) || b.amount - a.amount)
      .slice(0, 15);
  }, [claims, players]);

  const exportCSV = () => {
    let csv = 'Spiller,Type krav,Beløp,Forfallsdato,Status\n';
    overdueRows.forEach(r => {
      csv += `"${r.playerName}","${r.type}",${r.amount},"${r.due_date || ''}","${r.isOverdue ? 'Forfalt' : 'Utestående'}"\n`;
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `utestående_${currentTeam?.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const sendEmail = async () => {
    if (!user?.email) return;
    setSending(true);
    const lines = [`Rapport: ${currentTeam?.name}`, `Innbetalinger denne mnd: ${formatNOK(stats.monthIncome)}`, `Utgifter denne mnd: ${formatNOK(stats.monthExpense)}`, `Utestående totalt: ${formatNOK(stats.outstanding)}`];
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `Månedlig oversikt – ${currentTeam?.name}`,
      body: lines.join('\n'),
    });
    setSending(false);
  };

  if (!currentTeam) return <p className="text-center py-12 text-slate-500">Velg et lag for å se rapporter.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapporter</h1>
          <p className="text-sm text-slate-500">Oversikt over økonomi og utestående krav</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <FileDown className="w-4 h-4" /> Eksporter
          </Button>
          <Button variant="outline" onClick={sendEmail} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} E-post
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Utestående krav" value={formatNOK(stats.outstanding)} icon={AlertTriangle} color="red" subtitle="Sum ubetalte krav" />
        <KpiCard title="Innbetalinger (mnd)" value={formatNOK(stats.monthIncome)} icon={TrendingUp} color="green" subtitle="Inneværende måned" />
        <KpiCard title="Utgifter (mnd)" value={formatNOK(stats.monthExpense)} icon={TrendingDown} color="amber" subtitle="Inneværende måned" />
      </div>

      {/* Main chart: Income vs Expenses 12 months */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Inntekter vs. utgifter – {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasTransactions ? (
            <EmptyState message="Importer transaksjoner for å se trend. Gå til Transaksjoner → Last opp CSV." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} width={48} />
                  <Tooltip formatter={v => formatNOK(v)} />
                  <Legend />
                  <Bar dataKey="income" name="Innbetalinger" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Utgifter" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="income" name="Trend inn" stroke="#059669" strokeWidth={2} dot={false} hide />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overdue / outstanding table */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Forfalte og utestående krav
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overdueRows.length === 0 ? (
            <EmptyState message="Ingen utestående krav. Bra jobbet!" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Spiller</TableHead>
                    <TableHead>Type krav</TableHead>
                    <TableHead>Forfallsdato</TableHead>
                    <TableHead className="text-right">Beløp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueRows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.playerName}</TableCell>
                      <TableCell className="text-sm capitalize">{r.type}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {r.due_date ? new Date(r.due_date).toLocaleDateString('nb-NO') : '–'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">{formatNOK(r.amount)}</TableCell>
                      <TableCell>
                        <Badge className={r.isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}>
                          {r.isOverdue ? 'Forfalt' : 'Utestående'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced section – collapsed by default */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAdvanced(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" />
            Avanserte rapporter
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 text-xs">Pro</Badge>
          </span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showAdvanced && (
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <p className="text-sm text-slate-500">
              Avanserte analyser, AI-prognoser, likviditetsoversikt, NIF-årsrapport og mer finner du under <strong>Avansert → Avanserte analyser</strong> i menyen.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="#" onClick={e => { e.preventDefault(); window.location.hash = 'AdvancedAnalytics'; }}>
                Gå til avanserte analyser →
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}