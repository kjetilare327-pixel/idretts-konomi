import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNOK } from '@/components/shared/FormatUtils';
import { Building2, Plus, Trash2, RefreshCw, Wifi, WifiOff, PiggyBank, CreditCard, Banknote } from 'lucide-react';

const BANKS = ['DNB', 'Sparebank 1', 'Nordea', 'Handelsbanken', 'Storebrand', 'Sbanken', 'Annen bank'];
const CURRENCIES = ['NOK', 'EUR', 'USD', 'SEK', 'DKK'];
const ACCOUNT_ICONS = { checking: Building2, savings: PiggyBank, reserve: CreditCard, other: Banknote };

const STORAGE_KEY = 'idrettsøkonomi_bank_accounts';

// Simulate real-time balance fetch with small random fluctuation
function simulateFetchBalance(account) {
  const base = account.balance || 0;
  const fluctuation = (Math.random() - 0.5) * base * 0.002; // ±0.1%
  return Promise.resolve(Math.round(base + fluctuation));
}

export default function BankAccountManager({ totalTransactionBalance }) {
  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    // Default seeded accounts based on transaction balance
    const base = totalTransactionBalance || 0;
    return [
      { id: '1', name: 'Driftskonto', bank: 'DNB', accountNumber: '1234.56.78901', currency: 'NOK', type: 'checking', balance: Math.round(base * 0.7), lastUpdated: new Date().toISOString() },
      { id: '2', name: 'Sparekonto', bank: 'Sparebank 1', accountNumber: '9876.54.32100', currency: 'NOK', type: 'savings', balance: Math.round(base * 0.2), lastUpdated: new Date().toISOString() },
      { id: '3', name: 'Reservefond', bank: 'DNB', accountNumber: '1111.22.33344', currency: 'NOK', type: 'reserve', balance: Math.round(base * 0.1), lastUpdated: new Date().toISOString() },
    ];
  });

  const [refreshing, setRefreshing] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', bank: 'DNB', accountNumber: '', currency: 'NOK', type: 'checking', balance: '' });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }, [accounts]);

  const refreshAccount = async (id) => {
    setRefreshing(r => ({ ...r, [id]: true }));
    const acc = accounts.find(a => a.id === id);
    const newBalance = await simulateFetchBalance(acc);
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, balance: newBalance, lastUpdated: new Date().toISOString() } : a));
    setRefreshing(r => ({ ...r, [id]: false }));
  };

  const refreshAll = async () => {
    for (const acc of accounts) {
      await refreshAccount(acc.id);
    }
  };

  const addAccount = () => {
    if (!form.name || !form.accountNumber) return;
    const newAcc = {
      id: Date.now().toString(),
      ...form,
      balance: Number(form.balance) || 0,
      lastUpdated: new Date().toISOString(),
    };
    setAccounts(prev => [...prev, newAcc]);
    setShowForm(false);
    setForm({ name: '', bank: 'DNB', accountNumber: '', currency: 'NOK', type: 'checking', balance: '' });
  };

  const removeAccount = (id) => setAccounts(prev => prev.filter(a => a.id !== id));

  const totalLiquidity = accounts.reduce((s, a) => s + (a.currency === 'NOK' ? a.balance : a.balance), 0);

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Bankkonti
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Konsolidert oversikt – simulert sanntidsdata</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={refreshAll} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Oppdater alle
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="w-3.5 h-3.5" /> Legg til konto
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Total */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-950/20 dark:to-emerald-950/20 border border-blue-100 dark:border-blue-900">
          <p className="text-xs text-slate-500 mb-1">Total likviditet (alle kontoer)</p>
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{formatNOK(totalLiquidity)}</p>
          <p className="text-xs text-slate-400 mt-1">{accounts.length} kontoer registrert</p>
        </div>

        {/* Account cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map(acc => {
            const Icon = ACCOUNT_ICONS[acc.type] || Building2;
            const isRefreshing = refreshing[acc.id];
            const lastUpdated = acc.lastUpdated ? new Date(acc.lastUpdated).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div key={acc.id} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group relative">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-white dark:bg-slate-700 shadow-sm">
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{acc.name}</p>
                      <p className="text-xs text-slate-400">{acc.bank}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => refreshAccount(acc.id)}>
                      <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => removeAccount(acc.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <p className={`text-xl font-bold ${acc.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatNOK(acc.balance)}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-400 font-mono">{acc.accountNumber}</p>
                  <Badge variant="outline" className="text-xs py-0">{acc.currency}</Badge>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {isRefreshing ? <WifiOff className="w-3 h-3 text-slate-400 animate-pulse" /> : <Wifi className="w-3 h-3 text-emerald-500" />}
                  <p className="text-xs text-slate-400">Oppdatert {lastUpdated}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Legg til bankkonto</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Kontonavn</Label>
                <Input placeholder="f.eks. Driftskonto" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Bank</Label>
                <Select value={form.bank} onValueChange={v => setForm({ ...form, bank: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Kontonummer</Label>
              <Input placeholder="XXXX.XX.XXXXX" value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Driftskonto</SelectItem>
                    <SelectItem value="savings">Sparekonto</SelectItem>
                    <SelectItem value="reserve">Reservefond</SelectItem>
                    <SelectItem value="other">Annet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valuta</Label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Saldo (NOK)</Label>
                <Input type="number" min="0" placeholder="0" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Avbryt</Button>
              <Button onClick={addAccount} disabled={!form.name || !form.accountNumber} className="flex-1 bg-blue-600 hover:bg-blue-700">Legg til</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}