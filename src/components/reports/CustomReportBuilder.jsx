import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileDown, Loader2, Sparkles, Save, FolderOpen, Trash2, BarChart3 } from 'lucide-react';
import { formatNOK, formatDate } from '@/components/shared/FormatUtils';

const REPORT_TEMPLATES_KEY = 'custom_report_templates';

const PERIOD_PRESETS = [
  { label: 'Dette året', getValue: () => ({ startDate: `${new Date().getFullYear()}-01-01`, endDate: new Date().toISOString().split('T')[0] }) },
  { label: 'Forrige år', getValue: () => ({ startDate: `${new Date().getFullYear()-1}-01-01`, endDate: `${new Date().getFullYear()-1}-12-31` }) },
  { label: 'Siste 6 mnd', getValue: () => { const d = new Date(); d.setMonth(d.getMonth()-6); return { startDate: d.toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] }; } },
  { label: 'Siste 3 mnd', getValue: () => { const d = new Date(); d.setMonth(d.getMonth()-3); return { startDate: d.toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] }; } },
  { label: 'Denne måneden', getValue: () => { const n = new Date(); return { startDate: `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`, endDate: n.toISOString().split('T')[0] }; } },
];

export default function CustomReportBuilder({ teamId }) {
  const [config, setConfig] = useState({
    name: '',
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    includeTransactions: true,
    includeMembers: true,
    includeBudget: true,
    includeClaims: true,
    transactionTypes: ['income', 'expense'],
    categories: [],
    paymentStatus: ['paid', 'partial', 'unpaid'],
    format: 'csv'
  });

  const [generating, setGenerating] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);
  const [savedTemplates, setSavedTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem(REPORT_TEMPLATES_KEY) || '[]'); } catch { return []; }
  });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', teamId],
    queryFn: () => base44.entities.Transaction.filter({ team_id: teamId }),
    enabled: !!teamId,
  });
  const { data: players = [] } = useQuery({
    queryKey: ['players', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
    enabled: !!teamId,
  });
  const { data: budget = [] } = useQuery({
    queryKey: ['budget', teamId],
    queryFn: () => base44.entities.Budget.filter({ team_id: teamId }),
    enabled: !!teamId,
  });
  const { data: claims = [] } = useQuery({
    queryKey: ['claims', teamId],
    queryFn: () => base44.entities.Claim.filter({ team_id: teamId }),
    enabled: !!teamId,
  });

  const allCategories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category).filter(Boolean));
    return [...cats];
  }, [transactions]);

  const filterData = () => {
    const start = new Date(config.startDate);
    const end = new Date(config.endDate);
    return {
      transactions: config.includeTransactions
        ? transactions.filter(t => {
            const d = new Date(t.date);
            const inRange = d >= start && d <= end;
            const typeMatch = config.transactionTypes.includes(t.type);
            const catMatch = config.categories.length === 0 || config.categories.includes(t.category);
            return inRange && typeMatch && catMatch && t.status === 'active';
          })
        : [],
      players: config.includeMembers
        ? players.filter(p => config.paymentStatus.includes(p.payment_status) && p.status === 'active')
        : [],
      budget: config.includeBudget ? budget : [],
      claims: config.includeClaims
        ? claims.filter(c => { const d = new Date(c.due_date); return d >= start && d <= end; })
        : [],
    };
  };

  const getDataSummary = () => {
    const data = filterData();
    const totalIncome = data.transactions.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
    const totalExpense = data.transactions.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
    const totalOutstanding = data.claims.filter(c => c.status !== 'paid').reduce((s,c) => s+c.amount, 0);
    const budgetedIncome = data.budget.filter(b => b.type === 'income').reduce((s,b) => s+(b.yearly_amount || b.monthly_amount*12), 0);
    const budgetedExpense = data.budget.filter(b => b.type === 'expense').reduce((s,b) => s+(b.yearly_amount || b.monthly_amount*12), 0);
    return { data, totalIncome, totalExpense, totalOutstanding, budgetedIncome, budgetedExpense };
  };

  const generateAIInsights = async () => {
    setLoadingAI(true);
    setAiInsights(null);
    const { data, totalIncome, totalExpense, totalOutstanding, budgetedIncome, budgetedExpense } = getDataSummary();
    const prompt = `Du er en finansiell rådgiver for et idrettslag. Analyser følgende økonomidata og gi innsikt på norsk.

Rapportperiode: ${formatDate(config.startDate)} – ${formatDate(config.endDate)}
Totale inntekter: ${formatNOK(totalIncome)}
Totale utgifter: ${formatNOK(totalExpense)}
Netto: ${formatNOK(totalIncome - totalExpense)}
Budsjettert inntekt (år): ${formatNOK(budgetedIncome)}
Budsjettert utgift (år): ${formatNOK(budgetedExpense)}
Utestående krav: ${formatNOK(totalOutstanding)}
Antall transaksjoner: ${data.transactions.length}
Antall aktive medlemmer: ${data.players.length}

Gi en strukturert analyse med:
1. Oppsummering (2-3 setninger)
2. Viktigste funn (3 punkter)
3. Risikoer å følge med på (2 punkter)
4. Konkrete anbefalinger (3 punkter)

Fokuser utelukkende på økonomi, budsjett og finansiell helse.`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            key_findings: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      setAiInsights(res);
    } catch(e) {
      setAiInsights({ error: true });
    } finally {
      setLoadingAI(false);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    const { data, totalIncome, totalExpense, totalOutstanding } = getDataSummary();
    try {
      if (config.format === 'csv') {
        let csv = `EGENDEFINERT RAPPORT\nPeriode: ${formatDate(config.startDate)} - ${formatDate(config.endDate)}\n\n`;
        if (data.transactions.length > 0) {
          csv += 'TRANSAKSJONER\nDato,Type,Kategori,Beløp,Beskrivelse\n';
          data.transactions.forEach(t => {
            csv += `${formatDate(t.date)},${t.type === 'income' ? 'Inntekt' : 'Utgift'},${t.category},${t.amount},"${t.description || ''}"\n`;
          });
          csv += `\nTotale inntekter,,,${totalIncome}\nTotale utgifter,,,${totalExpense}\nNetto,,,${totalIncome - totalExpense}\n\n`;
        }
        if (data.players.length > 0) {
          csv += 'MEDLEMMER\nNavn,E-post,Saldo,Betalingsstatus\n';
          data.players.forEach(p => { csv += `${p.full_name},${p.user_email},${p.balance || 0},${p.payment_status}\n`; });
          csv += '\n';
        }
        if (data.budget.length > 0) {
          csv += 'BUDSJETT\nKategori,Type,Månedlig,Årlig\n';
          data.budget.forEach(b => { csv += `${b.category},${b.type === 'income' ? 'Inntekt' : 'Utgift'},${b.monthly_amount},${b.yearly_amount || b.monthly_amount*12}\n`; });
          csv += '\n';
        }
        if (data.claims.length > 0) {
          csv += 'KRAV\nType,Beløp,Forfallsdato,Status\n';
          data.claims.forEach(c => { csv += `${c.type},${c.amount},${formatDate(c.due_date)},${c.status}\n`; });
          csv += `\nUtestående krav,${totalOutstanding}\n`;
        }
        if (aiInsights && !aiInsights.error) {
          csv += '\nAI OPPSUMMERING\n';
          csv += `"${aiInsights.summary}"\n\n`;
          aiInsights.recommendations?.forEach((r, i) => { csv += `Anbefaling ${i+1},"${r}"\n`; });
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `rapport_${config.startDate}_${config.endDate}.csv`; a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setGenerating(false);
    }
  };

  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const newTemplate = { id: Date.now(), name: templateName, config: { ...config, name: templateName } };
    const updated = [...savedTemplates, newTemplate];
    setSavedTemplates(updated);
    localStorage.setItem(REPORT_TEMPLATES_KEY, JSON.stringify(updated));
    setShowSaveDialog(false);
    setTemplateName('');
  };

  const loadTemplate = (tmpl) => {
    setConfig(tmpl.config);
    setAiInsights(null);
  };

  const deleteTemplate = (id) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    localStorage.setItem(REPORT_TEMPLATES_KEY, JSON.stringify(updated));
  };

  const summary = getDataSummary();

  return (
    <div className="space-y-6">
      {/* Saved templates */}
      {savedTemplates.length > 0 && (
        <Card className="border-0 shadow-sm dark:bg-slate-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-500" />
              Lagrede rapportmaler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedTemplates.map(tmpl => (
                <div key={tmpl.id} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5">
                  <button onClick={() => loadTemplate(tmpl)} className="text-sm font-medium hover:text-indigo-600">{tmpl.name}</button>
                  <button onClick={() => deleteTemplate(tmpl.id)} className="ml-1 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-0 shadow-md dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Rapportkonfigurasjon</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Period presets */}
              <div className="space-y-2">
                <Label>Hurtigvalg periode</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PERIOD_PRESETS.map(p => (
                    <button key={p.label} onClick={() => setConfig({...config, ...p.getValue()})}
                      className="text-xs px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Fra</Label>
                  <Input type="date" value={config.startDate} onChange={e => setConfig({...config, startDate: e.target.value})} className="text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Til</Label>
                  <Input type="date" value={config.endDate} onChange={e => setConfig({...config, endDate: e.target.value})} className="text-sm" />
                </div>
              </div>

              {/* Data sources */}
              <div className="space-y-2">
                <Label>Datakilder</Label>
                {[
                  { id: 'includeTransactions', label: 'Transaksjoner' },
                  { id: 'includeMembers', label: 'Medlemmer/betalingsstatus' },
                  { id: 'includeBudget', label: 'Budsjett' },
                  { id: 'includeClaims', label: 'Krav og fakturaer' },
                ].map(src => (
                  <div key={src.id} className="flex items-center space-x-2">
                    <Checkbox id={src.id} checked={config[src.id]}
                      onCheckedChange={v => setConfig({...config, [src.id]: v})} />
                    <label htmlFor={src.id} className="text-sm cursor-pointer">{src.label}</label>
                  </div>
                ))}
              </div>

              {/* Transaction filters */}
              {config.includeTransactions && (
                <div className="space-y-2 pt-1 border-t">
                  <Label className="text-xs text-slate-500">Transaksjonstype</Label>
                  <div className="flex gap-3">
                    {[{v:'income',l:'Inntekt'},{v:'expense',l:'Utgift'}].map(t => (
                      <div key={t.v} className="flex items-center space-x-1.5">
                        <Checkbox id={t.v} checked={config.transactionTypes.includes(t.v)}
                          onCheckedChange={ch => setConfig({...config, transactionTypes: ch ? [...config.transactionTypes, t.v] : config.transactionTypes.filter(x => x !== t.v)})} />
                        <label htmlFor={t.v} className="text-sm cursor-pointer">{t.l}</label>
                      </div>
                    ))}
                  </div>
                  {allCategories.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Filtrer kategorier (blank = alle)</Label>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {allCategories.map(cat => (
                          <div key={cat} className="flex items-center space-x-1.5">
                            <Checkbox id={`cat-${cat}`} checked={config.categories.includes(cat)}
                              onCheckedChange={ch => setConfig({...config, categories: ch ? [...config.categories, cat] : config.categories.filter(x => x !== cat)})} />
                            <label htmlFor={`cat-${cat}`} className="text-xs cursor-pointer">{cat}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Format */}
              <div className="space-y-2">
                <Label>Eksportformat</Label>
                <Select value={config.format} onValueChange={v => setConfig({...config, format: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV (Excel-kompatibel)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={generateReport} disabled={generating} className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Last ned
            </Button>
            <Button onClick={() => setShowSaveDialog(true)} variant="outline" className="gap-2">
              <Save className="w-4 h-4" />
            </Button>
          </div>

          {showSaveDialog && (
            <div className="flex gap-2">
              <Input value={templateName} onChange={e => setTemplateName(e.target.value)}
                placeholder="Navn på mal..." className="text-sm" />
              <Button onClick={saveTemplate} size="sm" disabled={!templateName.trim()}>Lagre</Button>
              <Button onClick={() => setShowSaveDialog(false)} size="sm" variant="ghost">✕</Button>
            </div>
          )}
        </div>

        {/* Preview + AI */}
        <div className="lg:col-span-2 space-y-4">
          {/* Live summary */}
          <Card className="border-0 shadow-md dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-base">Forhåndsvisning – {formatDate(config.startDate)} til {formatDate(config.endDate)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-center">
                  <p className="text-xs text-slate-500 mb-1">Inntekter</p>
                  <p className="font-bold text-emerald-700 text-sm">{formatNOK(summary.totalIncome)}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-center">
                  <p className="text-xs text-slate-500 mb-1">Utgifter</p>
                  <p className="font-bold text-red-700 text-sm">{formatNOK(summary.totalExpense)}</p>
                </div>
                <div className={`p-3 rounded-lg text-center ${summary.totalIncome - summary.totalExpense >= 0 ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'bg-amber-50 dark:bg-amber-950/30'}`}>
                  <p className="text-xs text-slate-500 mb-1">Netto</p>
                  <p className={`font-bold text-sm ${summary.totalIncome - summary.totalExpense >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>{formatNOK(summary.totalIncome - summary.totalExpense)}</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-center">
                  <p className="text-xs text-slate-500 mb-1">Utestående</p>
                  <p className="font-bold text-orange-700 text-sm">{formatNOK(summary.totalOutstanding)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{summary.data.transactions.length} transaksjoner</span>
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{summary.data.players.length} medlemmer</span>
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{summary.data.claims.length} krav</span>
                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{summary.data.budget.length} budsjettlinjer</span>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card className="border-0 shadow-md dark:bg-slate-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    AI Oppsummering og innsikt
                  </CardTitle>
                  <CardDescription>AI analyserer dataene og gir finansielle anbefalinger</CardDescription>
                </div>
                <Button onClick={generateAIInsights} disabled={loadingAI} size="sm" variant="outline" className="gap-2">
                  {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loadingAI ? 'Analyserer...' : 'Analyser'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!aiInsights && !loadingAI && (
                <p className="text-sm text-slate-500 text-center py-6">Klikk «Analyser» for å generere AI-innsikt for rapporten din.</p>
              )}
              {loadingAI && (
                <div className="text-center py-6">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                  <p className="text-sm text-slate-500">AI analyserer økonomidata...</p>
                </div>
              )}
              {aiInsights && !aiInsights.error && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                    <p className="text-sm font-medium text-purple-900 dark:text-purple-100">{aiInsights.summary}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Viktige funn</h4>
                      <ul className="space-y-1.5">
                        {aiInsights.key_findings?.map((f, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5"><span className="text-indigo-500 mt-0.5">●</span>{f}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Risikoer</h4>
                      <ul className="space-y-1.5">
                        {aiInsights.risks?.map((r, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Anbefalinger</h4>
                      <ul className="space-y-1.5">
                        {aiInsights.recommendations?.map((r, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5">✓</span>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              {aiInsights?.error && (
                <Alert><AlertDescription>Kunne ikke generere AI-innsikt. Prøv igjen.</AlertDescription></Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}