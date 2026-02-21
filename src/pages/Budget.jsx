import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTeam } from '@/components/shared/TeamContext';
import { formatNOK } from '@/components/shared/FormatUtils';
import AiBudgetPlanner from '../components/budget/AiBudgetPlanner';
import AiBudgetGenerator from '../components/budget/AiBudgetGenerator';
import AutoBudgetGenerator from '../components/budget/AutoBudgetGenerator';
import ExpensePredictions from '../components/budget/ExpensePredictions';
import BudgetDeviationAlerts from '../components/budget/BudgetDeviationAlerts';
import AISeasonalForecast from '../components/budget/AISeasonalForecast';
import BudgetAlertConfig from '../components/reports/BudgetAlertConfig';
import AIBudgetAdjustments from '../components/budget/AIBudgetAdjustments';
import ProjectBudget from '../components/budget/ProjectBudget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, PiggyBank, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import BudgetDeviationBar from '@/components/dashboard/BudgetDeviationBar';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import NativeSelect from '@/components/mobile/NativeSelect';

export default function BudgetPage() {
  const { currentTeam } = useTeam();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState({ category: '', type: 'expense', monthly_amount: '', period: 'monthly' });
  const [saving, setSaving] = useState(false);

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets', currentTeam?.id],
    queryFn: () => base44.entities.Budget.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories', currentTeam?.id],
    queryFn: () => base44.entities.Category.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const spentByCategory = useMemo(() => {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const map = {};
    transactions.filter(t => t.date?.startsWith(curMonth)).forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [transactions]);

  const categories = allCategories.filter(c => c.type === form.type).map(c => c.name);

  const openNew = () => {
    setEditData(null);
    setForm({ category: '', type: 'expense', monthly_amount: '', period: 'monthly' });
    setShowForm(true);
  };

  const openEdit = (b) => {
    setEditData(b);
    setForm({ category: b.category, type: b.type, monthly_amount: String(b.monthly_amount), period: b.period || 'monthly' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.category || !form.monthly_amount) return;
    setSaving(true);
    const data = {
      team_id: currentTeam.id,
      category: form.category,
      type: form.type,
      monthly_amount: Number(form.monthly_amount),
      yearly_amount: Number(form.monthly_amount) * (form.period === 'yearly' ? 1 : 12),
      period: form.period,
    };
    if (editData?.id) {
      await base44.entities.Budget.update(editData.id, data);
    } else {
      await base44.entities.Budget.create(data);
    }
    setSaving(false);
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['budgets', currentTeam?.id] });
  };

  const handleDelete = async (id) => {
    await base44.entities.Budget.delete(id);
    queryClient.invalidateQueries({ queryKey: ['budgets', currentTeam?.id] });
  };

  const incomeBudgets = budgets.filter(b => b.type === 'income');
  const expenseBudgets = budgets.filter(b => b.type === 'expense');
  const totalBudgetIncome = incomeBudgets.reduce((s, b) => s + b.monthly_amount, 0);
  const totalBudgetExpense = expenseBudgets.reduce((s, b) => s + b.monthly_amount, 0);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['budgets', currentTeam?.id] });
    await queryClient.invalidateQueries({ queryKey: ['transactions', currentTeam?.id] });
  };

  if (!currentTeam) return <p className="text-center py-12 text-slate-500">Velg et lag for å se budsjett.</p>;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budsjett</h1>
          <p className="text-sm text-slate-500">Sett opp og følg budsjettet for {currentTeam.name}</p>
        </div>
        <div className="flex gap-3">
          <AiBudgetGenerator teamId={currentTeam.id} />
          <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Plus className="w-4 h-4" /> Legg til budsjettpost
          </Button>
        </div>
      </div>

      <AutoBudgetGenerator
        transactions={transactions}
        budgets={budgets}
        teamId={currentTeam.id}
        onApplyAll={() => queryClient.invalidateQueries({ queryKey: ['budgets', currentTeam.id] })}
      />

      <AiBudgetPlanner teamId={currentTeam?.id} onApplyBudget={() => queryClient.invalidateQueries({ queryKey: ['budgets'] })} />

      {/* AI Expense Predictions */}
      <ExpensePredictions teamId={currentTeam?.id} />

      {/* Smart budget alerts with cashflow */}
      <BudgetAlertConfig transactions={transactions} budgets={budgets} claims={[]} />

      {/* Budget deviation alerts */}
      <BudgetDeviationAlerts transactions={transactions} budgets={budgets} />

      {/* AI Seasonal forecast */}
      <AISeasonalForecast teamId={currentTeam?.id} transactions={transactions} budgets={budgets} />

      {/* AI Budget Adjustments */}
      <AIBudgetAdjustments budgets={budgets} transactions={transactions} onApply={(adj) => {
        const match = budgets.find(b => b.category === adj.category);
        if (match) {
          setEditData(match);
          setForm({ category: match.category, type: match.type, monthly_amount: String(adj.suggested_amount), period: match.period || 'monthly' });
          setShowForm(true);
        }
      }} />

      {/* Project Budgets */}
      <ProjectBudget transactions={transactions} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Budsjett inntekter/mnd</p>
              <p className="text-lg font-bold">{formatNOK(totalBudgetIncome)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Budsjett utgifter/mnd</p>
              <p className="text-lg font-bold">{formatNOK(totalBudgetExpense)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
              <PiggyBank className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Netto budsjett/mnd</p>
              <p className="text-lg font-bold">{formatNOK(totalBudgetIncome - totalBudgetExpense)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deviation chart */}
      {expenseBudgets.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Budsjettavvik denne måneden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {expenseBudgets.map(b => (
              <BudgetDeviationBar key={b.id} category={b.category} spent={spentByCategory[b.category] || 0} budgeted={b.monthly_amount} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Budget lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[{ title: 'Inntektsbudsjett', items: incomeBudgets, type: 'income' }, { title: 'Utgiftsbudsjett', items: expenseBudgets, type: 'expense' }].map(section => (
          <Card key={section.type} className="border-0 shadow-md dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {section.type === 'income' ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
              ) : section.items.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">Ingen budsjettpost lagt til</p>
              ) : (
                <div className="space-y-3">
                  {section.items.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 group">
                      <div>
                        <p className="font-medium text-sm">{b.category}</p>
                        <p className="text-xs text-slate-500">{b.period === 'yearly' ? 'Årlig' : 'Månedlig'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">{formatNOK(b.monthly_amount)}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(b.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editData ? 'Rediger budsjettpost' : 'Ny budsjettpost'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <NativeSelect
                value={form.type}
                onValueChange={v => setForm({ ...form, type: v, category: '' })}
                title="Type"
                options={[{ value: 'income', label: 'Inntekt' }, { value: 'expense', label: 'Utgift' }]}
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <NativeSelect
                value={form.category}
                onValueChange={v => setForm({ ...form, category: v })}
                title="Kategori"
                placeholder="Velg kategori"
                options={categories.map(c => ({ value: c, label: c }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Beløp (NOK)</Label>
                <Input type="number" min="0" value={form.monthly_amount} onChange={e => setForm({ ...form, monthly_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Periode</Label>
                <NativeSelect
                  value={form.period}
                  onValueChange={v => setForm({ ...form, period: v })}
                  title="Periode"
                  options={[{ value: 'monthly', label: 'Månedlig' }, { value: 'yearly', label: 'Årlig' }]}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Avbryt</Button>
              <Button onClick={handleSave} disabled={saving || !form.category || !form.monthly_amount} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Lagre
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </PullToRefresh>
  );
}