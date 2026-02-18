import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, FolderOpen, TrendingUp, TrendingDown } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

const STORAGE_KEY = 'project_budgets';

export default function ProjectBudget({ transactions = [] }) {
  const [projects, setProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', income_budget: '', expense_budget: '', start_date: '', end_date: '' });

  const save = () => {
    if (!form.name) return;
    const updated = [...projects, { id: Date.now(), ...form, income_budget: Number(form.income_budget)||0, expense_budget: Number(form.expense_budget)||0 }];
    setProjects(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setShowForm(false);
    setForm({ name: '', description: '', income_budget: '', expense_budget: '', start_date: '', end_date: '' });
  };

  const remove = (id) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const getProjectActuals = (project) => {
    const start = project.start_date ? new Date(project.start_date) : null;
    const end = project.end_date ? new Date(project.end_date) : null;
    const relevant = transactions.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return (!start || d >= start) && (!end || d <= end);
    });
    const income = relevant.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = relevant.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense };
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-500" />
            <div>
              <CardTitle className="text-base">Prosjekt- og arrangementsbudsjett</CardTitle>
              <CardDescription>Definer egne budsjetter for spesifikke prosjekter eller perioder</CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-3.5 h-3.5" /> Nytt prosjekt
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Ingen prosjektbudsjetter opprettet ennå.</p>
        ) : (
          <div className="space-y-4">
            {projects.map(p => {
              const actuals = getProjectActuals(p);
              const expensePct = p.expense_budget > 0 ? Math.min(100, (actuals.expense / p.expense_budget) * 100) : 0;
              const incomePct = p.income_budget > 0 ? Math.min(100, (actuals.income / p.income_budget) * 100) : 0;
              return (
                <div key={p.id} className="p-4 rounded-lg border dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-semibold text-sm">{p.name}</span>
                      {p.description && <p className="text-xs text-slate-500">{p.description}</p>}
                      {(p.start_date || p.end_date) && (
                        <p className="text-xs text-slate-400">{p.start_date} → {p.end_date || '...'}</p>
                      )}
                    </div>
                    <button onClick={() => remove(p.id)} className="text-slate-400 hover:text-red-500 ml-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1 text-emerald-600"><TrendingUp className="w-3 h-3" />Inntekt</span>
                        <span>{formatNOK(actuals.income)} / {formatNOK(p.income_budget)}</span>
                      </div>
                      <Progress value={incomePct} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1 text-red-600"><TrendingDown className="w-3 h-3" />Utgift</span>
                        <span className={expensePct >= 100 ? 'text-red-600 font-semibold' : ''}>{formatNOK(actuals.expense)} / {formatNOK(p.expense_budget)}</span>
                      </div>
                      <Progress value={expensePct} className="h-1.5" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-right">
                    <span className={`font-semibold ${actuals.income - actuals.expense >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      Netto: {formatNOK(actuals.income - actuals.expense)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nytt prosjektbudsjett</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Prosjektnavn</Label><Input className="mt-1" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="F.eks. Sommercup 2025" /></div>
            <div><Label>Beskrivelse (valgfritt)</Label><Input className="mt-1" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Budsjett inntekter (NOK)</Label><Input type="number" className="mt-1" value={form.income_budget} onChange={e => setForm({...form, income_budget: e.target.value})} /></div>
              <div><Label>Budsjett utgifter (NOK)</Label><Input type="number" className="mt-1" value={form.expense_budget} onChange={e => setForm({...form, expense_budget: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Startdato</Label><Input type="date" className="mt-1" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
              <div><Label>Sluttdato</Label><Input type="date" className="mt-1" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Avbryt</Button>
              <Button onClick={save} disabled={!form.name} className="flex-1 bg-indigo-600 hover:bg-indigo-700">Opprett</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}