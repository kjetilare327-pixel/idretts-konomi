import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, AlertTriangle, TrendingDown, CheckCircle2, Settings2, X } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

const STORAGE_KEY = 'budget_alert_config';

const DEFAULT_CONFIG = {
  enabled: true,
  overrunThreshold: 90,   // % of budget used before warning
  cashflowMinBalance: 0,  // alert if projected balance drops below this
  emailAlerts: false,
  categories: {},          // per-category overrides
};

export default function BudgetAlertConfig({ transactions, budgets, claims }) {
  const [config, setConfig] = useState(() => {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch { return DEFAULT_CONFIG; }
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  // Compute current-month actuals
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  const monthActuals = useMemo(() => {
    const map = {};
    transactions.filter(t => t.date?.startsWith(currentMonth)).forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [transactions, currentMonth]);

  // Compute alerts
  const alerts = useMemo(() => {
    if (!config.enabled) return [];
    const result = [];

    budgets.filter(b => b.type === 'expense').forEach(b => {
      const spent = monthActuals[b.category] || 0;
      const threshold = config.categories[b.category] ?? config.overrunThreshold;
      const pct = b.monthly_amount > 0 ? (spent / b.monthly_amount) * 100 : 0;

      if (pct >= 100) {
        result.push({ level: 'critical', category: b.category, spent, budgeted: b.monthly_amount, pct, msg: `Budsjett for ${b.category} er overskredet (${pct.toFixed(0)}%)` });
      } else if (pct >= threshold) {
        result.push({ level: 'warning', category: b.category, spent, budgeted: b.monthly_amount, pct, msg: `${b.category} er på ${pct.toFixed(0)}% av budsjett` });
      }
    });

    // Cashflow check: sum income this month vs expenses + overdue claims
    const incomeThisMonth = transactions.filter(t => t.date?.startsWith(currentMonth) && t.type === 'income').reduce((s,t) => s+t.amount, 0);
    const expenseThisMonth = transactions.filter(t => t.date?.startsWith(currentMonth) && t.type === 'expense').reduce((s,t) => s+t.amount, 0);
    const overdueSum = claims.filter(c => c.status === 'overdue').reduce((s,c) => s+c.amount, 0);
    const projectedBalance = incomeThisMonth - expenseThisMonth - overdueSum;

    if (projectedBalance < config.cashflowMinBalance) {
      result.push({ level: 'cashflow', msg: `Prosjektert saldo er ${formatNOK(projectedBalance)} (under grense ${formatNOK(config.cashflowMinBalance)})`, spent: Math.abs(projectedBalance), budgeted: 0, pct: 0 });
    }

    return result;
  }, [budgets, monthActuals, config, transactions, claims, currentMonth]);

  const criticalCount = alerts.filter(a => a.level === 'critical').length;
  const warningCount = alerts.filter(a => a.level === 'warning' || a.level === 'cashflow').length;

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${criticalCount > 0 ? 'bg-red-100 dark:bg-red-900/30' : warningCount > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
              <Bell className={`w-5 h-5 ${criticalCount > 0 ? 'text-red-600' : warningCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Budsjett- og kontantstrømsvarslinger
                {criticalCount > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{criticalCount} kritisk</Badge>}
                {warningCount > 0 && <Badge className="bg-amber-100 text-amber-700 text-xs">{warningCount} advarsel</Badge>}
              </CardTitle>
              <CardDescription>Automatiske varsler for budsjettoverskridelser og kontantstrømsavvik</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={config.enabled} onCheckedChange={v => setConfig(p => ({ ...p, enabled: v }))} />
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowSettings(!showSettings)}>
              <Settings2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showSettings && (
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-4 border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Innstillinger</span>
              <button onClick={() => setShowSettings(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Varsel ved budsjett % brukt</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="50" max="99" value={config.overrunThreshold}
                    onChange={e => setConfig(p => ({ ...p, overrunThreshold: Number(e.target.value) }))}
                    className="w-24 h-8 text-sm" />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Minimum kontantstrømsaldo</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" value={config.cashflowMinBalance}
                    onChange={e => setConfig(p => ({ ...p, cashflowMinBalance: Number(e.target.value) }))}
                    className="w-32 h-8 text-sm" />
                  <span className="text-xs text-slate-500">kr</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!config.enabled ? (
          <div className="flex items-center gap-2 py-4 text-slate-400">
            <BellOff className="w-5 h-5" />
            <span className="text-sm">Varsler er deaktivert</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm">Ingen aktive varsler – alt ser bra ut!</span>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                alert.level === 'critical' ? 'bg-red-50 dark:bg-red-950/20 border-red-200' :
                alert.level === 'cashflow' ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200' :
                'bg-amber-50 dark:bg-amber-950/20 border-amber-200'
              }`}>
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                  alert.level === 'critical' ? 'text-red-500' : alert.level === 'cashflow' ? 'text-blue-500' : 'text-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.msg}</p>
                  {alert.budgeted > 0 && (
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                      <span>Brukt: {formatNOK(alert.spent)}</span>
                      <span>Budsjett: {formatNOK(alert.budgeted)}</span>
                      <span className={`font-semibold ${alert.pct >= 100 ? 'text-red-600' : 'text-amber-600'}`}>{alert.pct.toFixed(0)}%</span>
                    </div>
                  )}
                  {alert.budgeted > 0 && (
                    <div className="mt-1.5 h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${alert.pct >= 100 ? 'bg-red-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(alert.pct, 100)}%` }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}