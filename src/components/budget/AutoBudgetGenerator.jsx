import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { formatNOK } from '@/components/shared/FormatUtils';
import { Sparkles, Loader2, CheckCircle2, TrendingUp, TrendingDown, RefreshCw, Save, ChevronDown, ChevronUp } from 'lucide-react';

export default function AutoBudgetGenerator({ transactions, budgets, teamId, onApplyAll }) {
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState(null);
  const [editedProposals, setEditedProposals] = useState({});
  const [applying, setApplying] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const historicalSummary = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;

    const byCategory = {};
    transactions.forEach(t => {
      if (!t.date) return;
      const year = new Date(t.date).getFullYear();
      if (year !== currentYear && year !== lastYear) return;
      const key = `${t.category}__${t.type}`;
      if (!byCategory[key]) byCategory[key] = { category: t.category, type: t.type, thisYear: 0, lastYear: 0, months: new Set() };
      if (year === currentYear) byCategory[key].thisYear += t.amount;
      else byCategory[key].lastYear += t.amount;
      byCategory[key].months.add(t.date.slice(0, 7));
    });

    return Object.values(byCategory).map(v => ({
      ...v,
      months: v.months.size,
      avgMonthly: v.thisYear / Math.max(v.months.size, 1),
    }));
  }, [transactions]);

  const generateProposals = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const nextYear = now.getFullYear() + 1;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Du er budsjettekspert for norske idrettslag. Analyser historiske transaksjonsdata og lag budsjettforslag for neste år (${nextYear}).

Historisk data (siste år):
${historicalSummary.map(h => `- ${h.category} (${h.type === 'income' ? 'Inntekt' : 'Utgift'}): Totalt ${formatNOK(h.thisYear)}, snitt ${formatNOK(h.avgMonthly)}/mnd over ${h.months} måneder`).join('\n')}

Eksisterende budsjetter:
${budgets.map(b => `- ${b.category} (${b.type}): ${formatNOK(b.monthly_amount)}/mnd`).join('\n')}

Basert på historisk forbruk og inntekter:
1. Foreslå månedlige budsjettbeløp per kategori for ${nextYear}
2. Juster for typisk sesonalisering og vekst (idrettslag vokser typisk 3-8% per år)
3. Identifiser kategorier med store avvik eller potensiell besparelse
4. Foreslå nye budsjettkategorier hvis det mangler viktige poster

Svar på norsk.`,
        response_json_schema: {
          type: 'object',
          properties: {
            year: { type: 'number' },
            summary: { type: 'string' },
            patterns_identified: { type: 'array', items: { type: 'string' } },
            budget_proposals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  type: { type: 'string', enum: ['income', 'expense'] },
                  suggested_monthly: { type: 'number' },
                  rationale: { type: 'string' },
                  change_pct: { type: 'number' },
                  confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                },
              },
            },
          },
        },
      });

      setProposals(result);
      // Init edited state
      const edits = {};
      (result.budget_proposals || []).forEach((p, i) => {
        edits[i] = p.suggested_monthly;
      });
      setEditedProposals(edits);
    } finally {
      setLoading(false);
    }
  };

  const applyAll = async () => {
    if (!proposals?.budget_proposals) return;
    setApplying(true);
    try {
      for (let i = 0; i < proposals.budget_proposals.length; i++) {
        const p = proposals.budget_proposals[i];
        const amount = Number(editedProposals[i]) || p.suggested_monthly;
        const existing = budgets.find(b => b.category === p.category && b.type === p.type);
        const data = {
          team_id: teamId,
          category: p.category,
          type: p.type,
          monthly_amount: amount,
          yearly_amount: amount * 12,
          period: 'monthly',
        };
        if (existing) {
          await base44.entities.Budget.update(existing.id, data);
        } else {
          await base44.entities.Budget.create(data);
        }
      }
      if (onApplyAll) onApplyAll();
      setProposals(null);
      setEditedProposals({});
    } finally {
      setApplying(false);
    }
  };

  const confidenceColor = c => c === 'high' ? 'bg-emerald-500' : c === 'medium' ? 'bg-amber-500' : 'bg-slate-400';

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-500" />
              Automatisk budsjettgenerator
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Analyser historikk og generer budsjettforslag for neste år</p>
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="ghost" onClick={() => setExpanded(e => !e)} className="h-8 w-8">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button onClick={generateProposals} disabled={loading} size="sm" className="bg-blue-600 hover:bg-blue-700 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generer forslag
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Historical summary chips */}
          {historicalSummary.length > 0 && !proposals && !loading && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Analyserer {historicalSummary.length} kategorier fra historikk:</p>
              <div className="flex flex-wrap gap-1.5">
                {historicalSummary.slice(0, 8).map((h, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {h.category} – {formatNOK(h.avgMonthly)}/mnd
                  </Badge>
                ))}
                {historicalSummary.length > 8 && (
                  <Badge variant="outline" className="text-xs text-slate-400">+{historicalSummary.length - 8} til</Badge>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-8 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
              <p className="text-sm">Analyserer transaksjonshistorikk og genererer budsjettforslag...</p>
            </div>
          )}

          {proposals && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">Budsjettforslag for {proposals.year}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{proposals.summary}</p>
              </div>

              {proposals.patterns_identified?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Identifiserte mønstre</p>
                  <ul className="space-y-0.5">
                    {proposals.patterns_identified.map((p, i) => (
                      <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                        <span className="text-blue-500 mt-0.5">•</span> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Foreslåtte budsjetter (justerbare)</p>
                  <Button onClick={applyAll} disabled={applying} size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                    {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Bruk alle
                  </Button>
                </div>

                <div className="space-y-2">
                  {(proposals.budget_proposals || []).map((p, i) => {
                    const existing = budgets.find(b => b.category === p.category && b.type === p.type);
                    const currentAmount = existing?.monthly_amount || 0;
                    const suggestedAmount = Number(editedProposals[i]) || p.suggested_monthly;
                    const delta = suggestedAmount - currentAmount;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {p.type === 'income'
                              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              : <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            <p className="text-sm font-medium truncate">{p.category}</p>
                            <Badge className={`text-xs py-0 ${confidenceColor(p.confidence)}`}>
                              {p.confidence === 'high' ? 'Høy' : p.confidence === 'medium' ? 'Medium' : 'Lav'} sikkerhet
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">{p.rationale}</p>
                          {currentAmount > 0 && delta !== 0 && (
                            <p className={`text-xs font-medium mt-0.5 ${delta > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {delta > 0 ? '↑' : '↓'} {Math.abs(p.change_pct || 0).toFixed(0)}% fra nåværende {formatNOK(currentAmount)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="number"
                            min="0"
                            className="w-28 h-8 text-sm text-right"
                            value={editedProposals[i] ?? p.suggested_monthly}
                            onChange={e => setEditedProposals(prev => ({ ...prev, [i]: Number(e.target.value) }))}
                          />
                          <span className="text-xs text-slate-400 whitespace-nowrap">/mnd</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}