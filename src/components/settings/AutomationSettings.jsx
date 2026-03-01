import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, CheckCircle, XCircle } from 'lucide-react';

const AUTOMATIONS = [
  { id: '6993de66afac94085a97b684', name: 'Ukentlige betalingspåminnelser', description: 'Sender påminnelser for ubetalte fakturaer hver uke' },
  { id: '699448045c6d5452b3688cf3', name: 'Profil fullføring påminnelse', description: 'Sender påminnelse til nye medlemmer om å fullføre profilen' },
  { id: '699448045c6d5452b3688cf4', name: 'Betalingspåminnelser', description: 'Sender automatisk påminnelse om betalinger som forfaller snart' },
  { id: '6993de66afac94085a97b683', name: 'Daglig generering av planlagte fakturaer', description: 'Sjekker og genererer fakturaer basert på aktive fakturaplaner' },
  { id: '69944b0ea43802a757717644', name: 'Generer AI-varsler daglig', description: 'Genererer personaliserte AI-drevne varsler' },
  { id: '6993dc371209ee0a1089ec59', name: 'Daglig AI-analyse av økonomi', description: 'Kjører AI-analyse av transaksjoner og budsjetter' },
  { id: '6993c50577cc9b6e917e17c7', name: 'Auto-påminnelse ubetalt', description: 'Sjekker daglig for forfalte krav og sender påminnelser' },
];

export default function AutomationSettings({ initialStates }) {
  // Build initial toggle state from what was fetched
  const buildInitial = () => {
    const map = {};
    AUTOMATIONS.forEach(a => {
      const found = initialStates?.find(s => s.id === a.id);
      map[a.id] = found ? found.is_active : true;
    });
    return map;
  };

  const [states, setStates] = useState(buildInitial);
  const [saving, setSaving] = useState({});

  const handleToggle = async (automationId, newValue) => {
    setSaving(s => ({ ...s, [automationId]: true }));
    setStates(s => ({ ...s, [automationId]: newValue }));
    try {
      const { base44 } = await import('@/api/base44Client');
      await base44.functions.invoke('toggleAutomation', { automation_id: automationId, is_active: newValue });
    } catch (error) {
      // Revert on error
      setStates(s => ({ ...s, [automationId]: !newValue }));
      alert('Feil ved endring: ' + error.message);
    } finally {
      setSaving(s => ({ ...s, [automationId]: false }));
    }
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-500" /> Automatiseringer
        </CardTitle>
        <CardDescription>Skru av/på automatiske oppgaver</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {AUTOMATIONS.map(automation => {
          const isActive = states[automation.id];
          const isSaving = saving[automation.id];
          return (
            <div key={automation.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium">{automation.name}</p>
                  <Badge className={isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}>
                    {isActive ? 'Aktiv' : 'Inaktiv'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">{automation.description}</p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={(v) => handleToggle(automation.id, v)}
                disabled={isSaving}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}