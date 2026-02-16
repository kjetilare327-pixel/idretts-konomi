import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTeam } from '@/components/shared/TeamContext';
import { formatNOK } from '@/components/shared/FormatUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, Plus, Pencil, Trash2, Mail, CheckCircle, AlertCircle, Clock, Loader2, Eye, EyeOff } from 'lucide-react';

export default function Players() {
  const { currentTeam, isTeamAdmin, playerProfile } = useTeam();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState({ full_name: '', user_email: '', role: 'player', balance: '0', payment_status: 'paid', phone: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players', currentTeam?.id],
    queryFn: () => base44.entities.Player.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const showNames = currentTeam?.show_player_names !== false;
  const isAdmin = isTeamAdmin();

  const summary = useMemo(() => {
    const totalOwed = players.filter(p => p.balance > 0).reduce((s, p) => s + p.balance, 0);
    const paid = players.filter(p => p.payment_status === 'paid').length;
    const unpaid = players.filter(p => p.payment_status === 'unpaid').length;
    const partial = players.filter(p => p.payment_status === 'partial').length;
    return { totalOwed, paid, unpaid, partial };
  }, [players]);

  const openNew = () => {
    setEditData(null);
    setForm({ full_name: '', user_email: '', role: 'player', balance: '0', payment_status: 'paid', phone: '', notes: '' });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditData(p);
    setForm({ 
      full_name: p.full_name, 
      user_email: p.user_email, 
      role: p.role, 
      balance: String(p.balance || 0), 
      payment_status: p.payment_status || 'paid',
      phone: p.phone || '',
      notes: p.notes || ''
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.user_email) return;
    setSaving(true);
    const data = {
      team_id: currentTeam.id,
      full_name: form.full_name,
      user_email: form.user_email,
      role: form.role,
      balance: Number(form.balance) || 0,
      payment_status: form.payment_status,
      phone: form.phone,
      notes: form.notes,
    };
    if (editData?.id) {
      await base44.entities.Player.update(editData.id, data);
    } else {
      await base44.entities.Player.create(data);
    }
    setSaving(false);
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['players', currentTeam?.id] });
  };

  const handleDelete = async (id) => {
    await base44.entities.Player.delete(id);
    queryClient.invalidateQueries({ queryKey: ['players', currentTeam?.id] });
  };

  const handleInvite = async (player) => {
    setInviting(true);
    try {
      await base44.users.inviteUser(player.user_email, 'user');
      alert(`Invitasjon sendt til ${player.user_email}`);
    } catch (e) {
      alert('Feil ved invitasjon: ' + e.message);
    }
    setInviting(false);
  };

  const statusConfig = {
    paid: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'Betalt' },
    partial: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', label: 'Delvis' },
    unpaid: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10', label: 'Ubetalt' },
  };

  if (!currentTeam) return <p className="text-center py-12 text-slate-500">Velg et lag for å se spillere.</p>;

  // Player view (ikke admin)
  if (!isAdmin) {
    const myBalance = playerProfile?.balance || 0;
    const myStatus = playerProfile?.payment_status || 'paid';
    const StatusIcon = statusConfig[myStatus]?.icon || CheckCircle;

    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Min økonomi</h1>
          <p className="text-sm text-slate-500">Din betalingsstatus for {currentTeam.name}</p>
        </div>

        {/* Min status */}
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className={`w-16 h-16 rounded-2xl ${statusConfig[myStatus]?.bg} flex items-center justify-center`}>
                <StatusIcon className={`w-8 h-8 ${statusConfig[myStatus]?.color}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">Din saldo</p>
                <p className={`text-3xl font-bold ${myBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {myBalance > 0 ? `Skylder ${formatNOK(myBalance)}` : myBalance < 0 ? `Kreditt ${formatNOK(-myBalance)}` : 'Ingen utestående'}
                </p>
                <Badge className={`${statusConfig[myStatus]?.bg} ${statusConfig[myStatus]?.color} border-0 mt-2`}>
                  {statusConfig[myStatus]?.label}
                </Badge>
              </div>
            </div>
            {myBalance > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                💡 Kontakt kasserer for betalingsdetaljer
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lagets betalingsoversikt */}
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" /> Lagets betalingsstatus
            </CardTitle>
            <CardDescription>Transparent oversikt over alle spillere</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{showNames ? 'Spiller' : 'ID'}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((p, i) => {
                  const config = statusConfig[p.payment_status] || statusConfig.paid;
                  const Icon = config.icon;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{showNames ? p.full_name : `Spiller ${String.fromCharCode(65 + i)}`}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          <span className="text-xs">{config.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${p.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {p.balance > 0 ? `+${formatNOK(p.balance)}` : p.balance < 0 ? formatNOK(p.balance) : '–'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spillere & Betalinger</h1>
          <p className="text-sm text-slate-500">{players.length} spillere registrert</p>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" /> Legg til spiller
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Totalt utestående</p>
            <p className="text-2xl font-bold text-red-600">{formatNOK(summary.totalOwed)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Betalt</p>
            <p className="text-2xl font-bold text-emerald-600">{summary.paid}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Delvis betalt</p>
            <p className="text-2xl font-bold text-amber-600">{summary.partial}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Ubetalt</p>
            <p className="text-2xl font-bold text-red-600">{summary.unpaid}</p>
          </CardContent>
        </Card>
      </div>

      {/* Players table */}
      <Card className="border-0 shadow-md dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead>Navn</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead className="w-32">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" /></TableCell></TableRow>
              ) : players.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400">Ingen spillere lagt til</TableCell></TableRow>
              ) : players.map(p => {
                const config = statusConfig[p.payment_status] || statusConfig.paid;
                const Icon = config.icon;
                return (
                  <TableRow key={p.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell className="text-sm text-slate-500">{p.user_email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${config.color}`} />
                        <span className="text-xs">{config.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${p.balance > 0 ? 'text-red-600' : p.balance < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {p.balance > 0 ? `+${formatNOK(p.balance)}` : p.balance < 0 ? formatNOK(p.balance) : '–'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {p.role === 'parent' ? 'Forelder' : 'Spiller'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleInvite(p)} disabled={inviting}>
                          <Mail className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editData ? 'Rediger spiller' : 'Legg til spiller'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fullt navn *</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>E-post *</Label>
                <Input type="email" value={form.user_email} onChange={e => setForm({ ...form, user_email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Rolle</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Spiller</SelectItem>
                    <SelectItem value="parent">Forelder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Saldo (NOK)</Label>
                <Input type="number" step="0.01" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.payment_status} onValueChange={v => setForm({ ...form, payment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Betalt</SelectItem>
                    <SelectItem value="partial">Delvis</SelectItem>
                    <SelectItem value="unpaid">Ubetalt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Interne notater</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Avbryt</Button>
              <Button onClick={handleSave} disabled={saving || !form.full_name || !form.user_email} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editData ? 'Oppdater' : 'Lagre'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}