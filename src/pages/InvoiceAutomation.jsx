import React, { useState, useMemo } from 'react';
import { useTeam } from '../components/shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PaymentReminderManager from '@/components/invoicing/PaymentReminderManager';
import AIInvoiceGenerator from '@/components/invoicing/AIInvoiceGenerator';
import ReceivablesReport from '@/components/invoicing/ReceivablesReport';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Calendar, DollarSign, Plus, Play, Pause, Settings, Send, CheckCircle2 } from 'lucide-react';
import { formatNOK } from '../components/shared/FormatUtils';
import ReadOnlyBanner from '@/components/shared/ReadOnlyBanner';
import { Loader2 } from 'lucide-react';

const FINANCE_ROLES = ['admin', 'kasserer', 'styreleder', 'revisor'];

function NonAdminInvoiceView({ currentTeam, user }) {
  const { useQuery } = require('@tanstack/react-query');
  const { data: summary, isLoading } = useQuery({
    queryKey: ['teamSummary', currentTeam?.id],
    queryFn: () => base44.functions.invoke('getTeamSummary', { team_id: currentTeam.id }).then(r => r.data),
    enabled: !!currentTeam,
    staleTime: 60000,
  });

  const { data: myClaims = [] } = useQuery({
    queryKey: ['myClaims', currentTeam?.id, user?.email],
    queryFn: async () => {
      const players = await base44.entities.Player.filter({ team_id: currentTeam.id, user_email: user.email });
      if (!players.length) return [];
      return base44.entities.Claim.filter({ player_id: players[0].id });
    },
    enabled: !!currentTeam && !!user?.email,
  });

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>;

  const claims = summary?.claims || {};
  const pendingMyClaims = myClaims.filter(c => c.status !== 'paid' && c.status !== 'cancelled');

  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <div>
        <h1 className="text-3xl font-bold mb-1">Fakturering</h1>
        <p className="text-slate-500 text-sm">Betalingsoversikt for {currentTeam.name}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Totalt fakturert', value: claims.totalClaimed || 0, color: 'text-slate-700 dark:text-slate-200' },
          { label: 'Betalt', value: claims.paidClaims || 0, color: 'text-emerald-600' },
          { label: 'Utestående', value: claims.pendingClaims || 0, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl shadow-md bg-white dark:bg-slate-900 p-5">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{formatNOK(s.value)}</p>
          </div>
        ))}
      </div>
      {pendingMyClaims.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base">Mine åpne krav</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingMyClaims.map(c => (
              <div key={c.id} className="flex justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div>
                  <span className="font-medium">{c.type}</span>
                  {c.description && <span className="text-slate-500 ml-2">{c.description}</span>}
                </div>
                <div className="text-right">
                  <span className="font-semibold text-amber-600">{formatNOK(c.amount)}</span>
                  {c.due_date && <p className="text-xs text-slate-400">Forfall: {new Date(c.due_date).toLocaleDateString('nb-NO')}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function InvoiceAutomation() {
  const { currentTeam, currentTeamRole, user, refreshTeams } = useTeam();
  const isAdmin = FINANCE_ROLES.includes(currentTeamRole);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState(false);
  const [togglingReminders, setTogglingReminders] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'kontingent',
    amount: 0,
    description: '',
    recurrence: 'monthly',
    target_players: 'all',
    specific_player_ids: [],
    next_invoice_date: '',
    due_days_after: 14,
    is_active: true
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['invoice-schedules', currentTeam?.id],
    queryFn: () => base44.entities.InvoiceSchedule.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', currentTeam?.id],
    queryFn: () => base44.entities.Player.filter({ team_id: currentTeam.id, status: 'active' }),
    enabled: !!currentTeam,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims', currentTeam?.id],
    queryFn: () => base44.entities.Claim.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const handleCreate = async () => {
    if (!form.name || !form.amount || !form.next_invoice_date) return;

    await base44.entities.InvoiceSchedule.create({
      ...form,
      team_id: currentTeam.id
    });

    setShowForm(false);
    setForm({
      name: '', type: 'kontingent', amount: 0, description: '', recurrence: 'monthly',
      target_players: 'all', specific_player_ids: [], next_invoice_date: '', due_days_after: 14, is_active: true
    });
    queryClient.invalidateQueries({ queryKey: ['invoice-schedules'] });
  };

  const handleToggleAutoReminders = async (enabled) => {
    if (!currentTeam) return;
    setTogglingReminders(true);
    try {
      await base44.entities.Team.update(currentTeam.id, { auto_reminders_enabled: enabled });
      await refreshTeams();
    } finally {
      setTogglingReminders(false);
    }
  };

  const handleToggle = async (scheduleId, currentStatus) => {
    await base44.entities.InvoiceSchedule.update(scheduleId, {
      is_active: !currentStatus
    });
    queryClient.invalidateQueries({ queryKey: ['invoice-schedules'] });
  };

  const runAutomation = async () => {
    setRunning(true);
    try {
      const response = await base44.functions.invoke('automateInvoicing', {
        team_id: currentTeam.id
      });
      
      alert(`Automatisering fullført!\n\n` +
        `Medlemsfakturaer: ${response.data.membership_invoices}\n` +
        `Arrangementsfakturaer: ${response.data.event_invoices}\n` +
        `Dugnadsbøter: ${response.data.volunteer_penalties}\n` +
        `Totalt beløp: ${formatNOK(response.data.total_amount)}`
      );
      
      queryClient.invalidateQueries({ queryKey: ['claims'] });
    } catch (error) {
      alert('Feil ved automatisering: ' + error.message);
    } finally {
      setRunning(false);
    }
  };

  if (!currentTeam) return <div className="p-6">Laster...</div>;
  if (!isAdmin) return <NonAdminInvoiceView currentTeam={currentTeam} user={user} />;

  const activeSchedules = schedules.filter(s => s.is_active);
  const inactiveSchedules = schedules.filter(s => !s.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Automatisk fakturering</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Automatiser generering av fakturaer og betalingskrav
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={runAutomation} disabled={running} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Play className="w-4 h-4" />
            {running ? 'Kjører...' : 'Kjør nå'}
          </Button>
          <Button onClick={() => setShowForm(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" />
            Ny fakturaregel
          </Button>
        </div>
      </div>

      {/* Active schedules */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-500" />
            Aktive fakturaautomatiseringer ({activeSchedules.length})
          </CardTitle>
          <CardDescription>Disse reglene kjører automatisk</CardDescription>
        </CardHeader>
        <CardContent>
          {activeSchedules.length > 0 ? (
            <div className="space-y-3">
              {activeSchedules.map(schedule => (
                <div key={schedule.id} className="p-4 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{schedule.name}</h3>
                        <Badge variant="outline">{schedule.type}</Badge>
                        <Badge className="bg-emerald-100 text-emerald-700">
                          {schedule.recurrence === 'monthly' ? 'Månedlig' :
                           schedule.recurrence === 'quarterly' ? 'Kvartalsvis' :
                           schedule.recurrence === 'yearly' ? 'Årlig' : 'Engangs'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{schedule.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1 text-slate-500">
                          <DollarSign className="w-4 h-4" />
                          {formatNOK(schedule.amount)}
                        </div>
                        <div className="flex items-center gap-1 text-slate-500">
                          <Calendar className="w-4 h-4" />
                          Neste: {new Date(schedule.next_invoice_date).toLocaleDateString('nb-NO')}
                        </div>
                        <div className="text-slate-500">
                          Mål: {schedule.target_players === 'all' ? 'Alle' :
                               schedule.target_players === 'players' ? 'Spillere' :
                               'Utvalgte'}
                        </div>
                      </div>
                      {schedule.last_generated && (
                        <p className="text-xs text-slate-500 mt-2">
                          Sist kjørt: {new Date(schedule.last_generated).toLocaleDateString('nb-NO')}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggle(schedule.id, schedule.is_active)}
                      className="gap-2"
                    >
                      <Pause className="w-4 h-4" />
                      Deaktiver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-slate-500">Ingen aktive fakturaautomatiseringer</p>
          )}
        </CardContent>
      </Card>

      {/* Inactive schedules */}
      {inactiveSchedules.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle>Inaktive automatiseringer ({inactiveSchedules.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactiveSchedules.map(schedule => (
                <div key={schedule.id} className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800 opacity-60">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{schedule.name}</h3>
                      <p className="text-xs text-slate-500">{formatNOK(schedule.amount)} • {schedule.recurrence}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggle(schedule.id, schedule.is_active)}
                      className="gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Aktiver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Invoice Generator */}
      <AIInvoiceGenerator teamId={currentTeam?.id} players={players} claims={claims} />

      {/* Receivables Report */}
      <ReceivablesReport claims={claims} players={players} />

      {/* Payment reminders */}
      <PaymentReminderManager
        teamId={currentTeam?.id}
        autoRemindersEnabled={currentTeam?.auto_reminders_enabled}
        onToggleAutoReminders={handleToggleAutoReminders}
      />

      {/* How it works */}
      <Card className="border-2 border-blue-200 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            Hvordan det fungerer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-600">1</span>
            </div>
            <p>Opprett en fakturaregel med beløp, hyppighet og målgruppe</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-600">2</span>
            </div>
            <p>Systemet genererer automatisk betalingskrav på angitt dato</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-600">3</span>
            </div>
            <p>Spillere mottar e-post med betalingslenke og forfallsdato</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-600">4</span>
            </div>
            <p>Ved betaling oppdateres saldo automatisk og transaksjon registreres</p>
          </div>
        </CardContent>
      </Card>

      {/* Create form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Opprett ny fakturaregel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Navn på regel</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="F.eks. Medlemskontingent vår 2024"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kontingent">Medlemskontingent</SelectItem>
                    <SelectItem value="cup">Cup/Turnering</SelectItem>
                    <SelectItem value="dugnad">Dugnadspli kt</SelectItem>
                    <SelectItem value="utstyr">Utstyr</SelectItem>
                    <SelectItem value="annet">Annet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Beløp (NOK)</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({...form, amount: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Beskrivelse (vises på faktura)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({...form, description: e.target.value})}
                placeholder="Beskrivelse av hva beløpet gjelder"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hyppighet</Label>
                <Select value={form.recurrence} onValueChange={(v) => setForm({...form, recurrence: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Én gang</SelectItem>
                    <SelectItem value="monthly">Månedlig</SelectItem>
                    <SelectItem value="quarterly">Kvartalsvis</SelectItem>
                    <SelectItem value="yearly">Årlig</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Første fakturadato</Label>
                <Input
                  type="date"
                  value={form.next_invoice_date}
                  onChange={(e) => setForm({...form, next_invoice_date: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Målgruppe</Label>
              <Select value={form.target_players} onValueChange={(v) => setForm({...form, target_players: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle medlemmer</SelectItem>
                  <SelectItem value="players">Kun spillere</SelectItem>
                  <SelectItem value="parents">Kun foreldre</SelectItem>
                  <SelectItem value="specific">Utvalgte personer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Betalingsfrist (dager)</Label>
              <Input
                type="number"
                value={form.due_days_after}
                onChange={(e) => setForm({...form, due_days_after: parseInt(e.target.value) || 14})}
              />
              <p className="text-xs text-slate-500">Antall dager fra fakturadato til forfall</p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({...form, is_active: v})}
              />
              <Label>Aktiver umiddelbart</Label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                Avbryt
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!form.name || !form.amount || !form.next_invoice_date}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                Opprett regel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}