import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bell, Plus, Trash2, MessageSquare, Mail, AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = (teamId) => `alert_thresholds_${teamId}`;

export default function AlertThresholdSettings({ teamId, transactions, budgets }) {
  const [thresholds, setThresholds] = useState([]);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsNumber, setSmsNumber] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Load from localStorage
  useEffect(() => {
    if (!teamId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY(teamId)) || '{}');
      if (saved.thresholds) setThresholds(saved.thresholds);
      if (saved.smsEnabled !== undefined) setSmsEnabled(saved.smsEnabled);
      if (saved.smsNumber) setSmsNumber(saved.smsNumber);
      if (saved.emailEnabled !== undefined) setEmailEnabled(saved.emailEnabled);
    } catch {}
  }, [teamId]);

  // Derive categories from transactions
  const expenseCategories = [...new Set(
    (transactions || []).filter(t => t.type === 'expense').map(t => t.category).filter(Boolean)
  )];

  // Current month spending per category
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthSpending = {};
  (transactions || []).filter(t => t.type === 'expense' && t.date?.startsWith(curMonth)).forEach(t => {
    monthSpending[t.category] = (monthSpending[t.category] || 0) + t.amount;
  });

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem(STORAGE_KEY(teamId), JSON.stringify({ thresholds, smsEnabled, smsNumber, emailEnabled }));
    setTimeout(() => {
      setSaving(false);
      toast.success('Innstillinger lagret');
    }, 400);
  };

  const addThreshold = () => {
    if (!newCategory || !newAmount) return;
    setThresholds(prev => [...prev, { id: Date.now(), category: newCategory, amount: Number(newAmount) }]);
    setNewCategory('');
    setNewAmount('');
  };

  const removeThreshold = (id) => {
    setThresholds(prev => prev.filter(t => t.id !== id));
  };

  const getAlertStatus = (threshold) => {
    const spent = monthSpending[threshold.category] || 0;
    const pct = threshold.amount > 0 ? (spent / threshold.amount) * 100 : 0;
    if (pct >= 100) return 'critical';
    if (pct >= 80) return 'warning';
    return 'ok';
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="w-4 h-4 text-amber-500" />
          Varselterskler
        </CardTitle>
        <CardDescription>Sett grenser per kategori og velg varslingskanal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Notification channels */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Varslingskanaler</p>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" />
              <span className="text-sm">E-post varsler</span>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-500" />
              <span className="text-sm">SMS varsler</span>
              <Badge variant="outline" className="text-xs">Beta</Badge>
            </div>
            <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
          </div>
          {smsEnabled && (
            <div className="space-y-1 pl-1">
              <Label className="text-xs">Mobilnummer for SMS</Label>
              <Input
                value={smsNumber}
                onChange={e => setSmsNumber(e.target.value)}
                placeholder="+47 900 00 000"
                className="h-8 text-sm"
              />
            </div>
          )}
        </div>

        {/* Category thresholds */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Budsjettgrenser (månedlig)</p>

          {thresholds.length === 0 && (
            <p className="text-xs text-slate-400 italic">Ingen terskler satt enda. Legg til nedenfor.</p>
          )}

          <div className="space-y-2">
            {thresholds.map(t => {
              const spent = monthSpending[t.category] || 0;
              const pct = t.amount > 0 ? Math.min((spent / t.amount) * 100, 100) : 0;
              const status = getAlertStatus(t);
              return (
                <div key={t.id} className="p-3 rounded-lg border bg-white dark:bg-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {status !== 'ok' && <AlertTriangle className={`w-3.5 h-3.5 ${status === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />}
                      <span className="text-sm font-medium">{t.category}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${status === 'critical' ? 'border-red-300 text-red-600' : status === 'warning' ? 'border-amber-300 text-amber-600' : 'border-emerald-300 text-emerald-600'}`}
                      >
                        {status === 'critical' ? 'Oversteget' : status === 'warning' ? 'Nær grense' : 'OK'}
                      </Badge>
                    </div>
                    <button onClick={() => removeThreshold(t.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{new Intl.NumberFormat('nb-NO').format(spent)} kr brukt</span>
                    <span>/</span>
                    <span>{new Intl.NumberFormat('nb-NO').format(t.amount)} kr grense</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${status === 'critical' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add new threshold */}
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Velg kategori...</option>
              {expenseCategories.filter(c => !thresholds.find(t => t.category === c)).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Input
              type="number"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              placeholder="Beløp kr"
              className="w-28 h-9"
            />
            <Button onClick={addThreshold} size="sm" variant="outline" className="gap-1">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Save className="w-4 h-4" />
          {saving ? 'Lagrer...' : 'Lagre innstillinger'}
        </Button>
      </CardContent>
    </Card>
  );
}