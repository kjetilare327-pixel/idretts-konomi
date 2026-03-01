import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { Sparkles, Send, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Users, X } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';
import PlayerPickerModal from './PlayerPickerModal';



export default function AiTransactionAssistant({ teamId, onDone }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(new Set());
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const textareaRef = useRef(null);

  const { data: players = [] } = useQuery({
    queryKey: ['players', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId, status: 'active' }),
    enabled: !!teamId,
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories', teamId],
    queryFn: () => base44.entities.Category.filter({ team_id: teamId }),
    enabled: !!teamId,
  });

  // Reset player selection when result changes
  useEffect(() => {
    if (result?.player_distribution) {
      const ids = new Set(result.player_distribution.map(p => p.player_id).filter(Boolean));
      setSelectedPlayerIds(ids);
    }
  }, [result]);

  const handleAnalyze = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setApplied(false);

    const playerList = players.map(p => ({ id: p.id, name: p.full_name }));
    const categoryList = allCategories.map(c => `${c.name} (${c.type})`).join(', ');

    const aiPrompt = `Du er en norsk idrettsklubbs økonomiassistent. Analyser følgende instruksjon og returner en strukturert plan for transaksjoner og spillerfordeling.

SPILLERE I LAGET (${players.length} totalt):
${playerList.map(p => `- ID: ${p.id}, Navn: ${p.name}`).join('\n')}

TILGJENGELIGE KATEGORIER: ${categoryList || 'Kontingent, Utstyr, Reisekostnader, Treningskostnader, Dugnad, Andre utgifter, Andre inntekter'}

INSTRUKSJON FRA BRUKER:
"${prompt}"

Returner JSON med følgende struktur:
{
  "summary": "Kort oppsummering av hva som gjøres",
  "main_transaction": {
    "type": "expense" | "income",
    "category": "kategori",
    "amount": 1234,
    "date": "YYYY-MM-DD",
    "description": "beskrivelse"
  },
  "player_distribution": [
    {
      "player_id": "id fra listen over (null om ikke matchet)",
      "player_name": "navn",
      "amount": 100,
      "type": "debt" | "credit",
      "description": "hva dette gjelder"
    }
  ],
  "total_distributed": 2000,
  "remainder": 0,
  "rounding_note": "forklaring på øreavrunding om nødvendig",
  "vat_note": "moms-info om relevant",
  "warnings": ["eventuelle advarsler"]
}

Regler:
- Summer av alle player amounts MÅ = main_transaction.amount (fordel remainder på første spiller)
- Rund til nærmeste hele krone
- Hvis moms nevnes, beregn eks. moms og inkl. moms separat
- Matche spillernavn mot listen over (fuzzy match på fornavn/etternavn)
- Hvis antall spillere nevnes men ikke hvem, sett player_id til null og marker for manuell valg
- Dato default = dagens dato (${format(new Date(), 'yyyy-MM-dd')})`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: aiPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            main_transaction: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                category: { type: 'string' },
                amount: { type: 'number' },
                date: { type: 'string' },
                description: { type: 'string' },
              },
            },
            player_distribution: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  player_id: { type: 'string' },
                  player_name: { type: 'string' },
                  amount: { type: 'number' },
                  type: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
            total_distributed: { type: 'number' },
            remainder: { type: 'number' },
            rounding_note: { type: 'string' },
            vat_note: { type: 'string' },
            warnings: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      setResult(res);
    } catch (e) {
      setError('Kunne ikke analysere instruksjonen. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickerConfirm = (chosenPlayers) => {
    if (chosenPlayers.length === 0) return;
    const names = chosenPlayers.map(p => p.full_name).join(', ');
    const prefix = chosenPlayers.length === 1
      ? `Spiller: ${names}. `
      : `Spillere (${chosenPlayers.length}): ${names}. `;
    setPrompt(prev => {
      const base = prev.trim();
      // Avoid duplicating the prefix if already there
      if (base.includes(prefix.trim())) return prev;
      return prefix + (base ? base : '');
    });
    // Focus textarea so user can continue typing
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const togglePlayer = (pid) => {
    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const handleApply = async () => {
    if (!result) return;
    setApplying(true);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      // 1. Create main transaction
      await base44.entities.Transaction.create({
        team_id: teamId,
        type: result.main_transaction.type,
        category: result.main_transaction.category,
        amount: result.main_transaction.amount,
        date: result.main_transaction.date || today,
        description: result.main_transaction.description,
      });

      // 2. Update player debts/balances
      const distributions = result.player_distribution || [];
      for (const dist of distributions) {
        // Find player: by id if matched, else skip if not in selectedPlayerIds
        let player = null;
        if (dist.player_id) {
          player = players.find(p => p.id === dist.player_id);
        }
        if (!player || !selectedPlayerIds.has(player.id)) continue;

        const delta = dist.type === 'debt' ? dist.amount : -dist.amount;
        const newBalance = (player.balance || 0) + delta;
        const newStatus = newBalance > 0 ? 'unpaid' : newBalance < 0 ? 'partial' : 'paid';

        await base44.entities.Player.update(player.id, {
          balance: Math.round(newBalance * 100) / 100,
          payment_status: newStatus,
        });

        // Create a Claim for debts
        if (dist.type === 'debt') {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 14);
          await base44.entities.Claim.create({
            team_id: teamId,
            player_id: player.id,
            amount: dist.amount,
            type: 'annet',
            description: dist.description || result.main_transaction.description,
            due_date: format(dueDate, 'yyyy-MM-dd'),
            status: 'pending',
          });
        }
      }

      setApplied(true);
      setTimeout(() => {
        onDone();
      }, 1500);
    } catch (e) {
      setError('Feil ved lagring. Prøv igjen.');
    } finally {
      setApplying(false);
    }
  };

  const needsManualPick = result?.player_distribution?.some(d => !d.player_id);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-violet-600" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">AI-transaksjonsassistent</h3>
          <p className="text-xs text-slate-500">Beskriv fordelingen på norsk – AI gjør resten</p>
        </div>
      </div>



      {/* Input */}
      {!result && (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            placeholder="F.eks: Trener brukte 2000 kr på mat til laget. Del likt på alle 20 spillere."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            className="resize-none"
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAnalyze(); }}
          />
          <div className="flex justify-between items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPickerModal(true)}
              className="gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-400 dark:hover:bg-violet-500/10 shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              Velg deltakere
            </Button>
            <span className="text-xs text-slate-400 hidden sm:block">Ctrl+Enter for å analysere</span>
            <Button
              onClick={handleAnalyze}
              disabled={loading || !prompt.trim()}
              className="bg-violet-600 hover:bg-violet-700 gap-2 shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Analyserer...' : 'Analyser'}
            </Button>
          </div>
        </div>
      )}

      <PlayerPickerModal
        open={showPickerModal}
        onClose={() => setShowPickerModal(false)}
        players={players}
        onConfirm={handlePickerConfirm}
      />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && !applied && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="p-3 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20">
            <p className="text-sm font-medium text-violet-800 dark:text-violet-300">{result.summary}</p>
            {result.vat_note && <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">{result.vat_note}</p>}
            {result.rounding_note && <p className="text-xs text-slate-500 mt-1">{result.rounding_note}</p>}
          </Card>

          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {w}
                </div>
              ))}
            </div>
          )}

          {/* Main transaction preview */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Hoved-transaksjon</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
                <p className="text-xs text-slate-400">Type</p>
                <p className="font-medium">{result.main_transaction.type === 'income' ? 'Inntekt' : 'Utgift'}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
                <p className="text-xs text-slate-400">Beløp</p>
                <p className="font-medium">{formatNOK(result.main_transaction.amount)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
                <p className="text-xs text-slate-400">Kategori</p>
                <p className="font-medium truncate">{result.main_transaction.category}</p>
              </div>
            </div>
          </div>

          {/* Player distribution */}
          {result.player_distribution?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Spillerfordeling ({result.player_distribution.length} spillere)
                </p>
                {needsManualPick && (
                  <button
                    onClick={() => setShowPlayerPicker(!showPlayerPicker)}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:underline"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Velg spillere manuelt
                    {showPlayerPicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Manual player picker */}
              {showPlayerPicker && (
                <div className="mb-3 p-3 border rounded-lg bg-slate-50 dark:bg-slate-800/50 max-h-40 overflow-y-auto space-y-1">
                  {players.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-slate-100 dark:hover:bg-slate-700/50 px-2 py-1 rounded">
                      <Checkbox
                        checked={selectedPlayerIds.has(p.id)}
                        onCheckedChange={() => togglePlayer(p.id)}
                      />
                      {p.full_name}
                    </label>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {result.player_distribution.map((d, i) => {
                  const matched = !!d.player_id;
                  const selected = selectedPlayerIds.has(d.player_id);
                  return (
                    <div
                      key={i}
                      onClick={() => d.player_id && togglePlayer(d.player_id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                        !matched
                          ? 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'
                          : selected
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {matched && (
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => togglePlayer(d.player_id)}
                            onClick={e => e.stopPropagation()}
                          />
                        )}
                        <div>
                          <span className="font-medium">{d.player_name}</span>
                          {!matched && <Badge variant="outline" className="ml-2 text-xs border-amber-400 text-amber-700">Ikke matchet</Badge>}
                          {d.description && <p className="text-xs text-slate-400">{d.description}</p>}
                        </div>
                      </div>
                      <span className={`font-semibold ${d.type === 'debt' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {d.type === 'debt' ? '+' : '−'}{formatNOK(d.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Totalt fordelt: {formatNOK(result.total_distributed)} · Klikk på en spiller for å inkludere/ekskludere
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              onClick={() => { setResult(null); setPrompt(''); }}
              className="flex-1 gap-2"
            >
              <X className="w-4 h-4" /> Endre
            </Button>
            <Button
              onClick={handleApply}
              disabled={applying}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {applying ? 'Lagrer...' : `Bekreft og lagre (${selectedPlayerIds.size} spillere)`}
            </Button>
          </div>
        </div>
      )}

      {/* Applied */}
      {applied && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="font-medium text-emerald-700 dark:text-emerald-400">Transaksjoner og krav lagret!</p>
          <p className="text-xs text-slate-500">Lukker automatisk...</p>
        </div>
      )}
    </div>
  );
}