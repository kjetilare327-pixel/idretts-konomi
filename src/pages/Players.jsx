import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTeam } from '@/components/shared/TeamContext';
import { formatNOK } from '@/components/shared/FormatUtils';
import { useLedger, STATUS_CONFIG } from '@/components/shared/useLedger';
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
import { Users, Plus, Pencil, Trash2, Mail, Loader2, Bell, FileText, AlertCircle, ExternalLink } from 'lucide-react';
import PlayerProfileCard from '../components/players/PlayerProfileCard';
import PlayerLedgerDetail from '../components/players/PlayerLedgerDetail';
import VippsClaimActions from '../components/players/VippsClaimActions';
import PullToRefresh from '@/components/mobile/PullToRefresh';

export default function Players() {
  const { currentTeam, playerProfile, user, currentTeamRole, loading: teamLoading, myMemberships } = useTeam();
  const queryClient = useQueryClient();
  const FINANCE_ROLES = ['admin', 'kasserer', 'styreleder', 'revisor'];
  const isAdmin = FINANCE_ROLES.includes(currentTeamRole);
  // roleReady: true once we've confirmed the role from memberships (not just the default)
  const roleReady = !teamLoading && !!currentTeam && (
    currentTeamRole !== 'player' ||
    Object.keys(myMemberships).length > 0 ||
    user?.email === currentTeam?.created_by
  );
  React.useEffect(() => {
    console.log(`[Players page] team=${currentTeam?.id} role=${currentTeamRole} isAdmin=${isAdmin} roleReady=${roleReady} user=${user?.email}`);
  }, [currentTeam?.id, currentTeamRole, isAdmin, roleReady]);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState({ full_name: '', user_email: '', role: 'player', balance: '0', payment_status: 'paid', phone: '', notes: '' });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Admins: always use getTeamPlayers backend function (service role, bypasses RLS).
  // Non-admins: fetch only own player record.
  // We include currentTeamRole in the queryKey so the query re-runs when the role resolves.
  const { data: players = [], isLoading, error: playersError } = useQuery({
    queryKey: ['players', currentTeam?.id, currentTeamRole, roleReady],
    queryFn: async () => {
      if (!currentTeam?.id) return [];
      console.log(`[Players] queryFn: team=${currentTeam.id} role=${currentTeamRole} isAdmin=${isAdmin}`);
      if (isAdmin) {
        const res = await base44.functions.invoke('getTeamPlayers', { team_id: currentTeam.id });
        const list = res?.data?.players || [];
        console.log(`[Players] admin → ${list.length} players`);
        return list;
      }
      // Non-admin: own profile only
      const u = await base44.auth.me();
      const list = await base44.entities.Player.filter({ team_id: currentTeam.id, user_email: u?.email });
      console.log(`[Players] non-admin user=${u?.email} → ${list.length} records`);
      return list;
    },
    enabled: !!currentTeam && roleReady,
    staleTime: 0,
  });

  const { ledgerMap, isLoading: loadingLedger } = useLedger(currentTeam?.id);

  const showNames = currentTeam?.show_player_names !== false;

  // Derive ledger for a player (falls back to stored balance if no claims/payments yet)
  const getLedger = (p) => {
    if (ledgerMap[p.id]) return ledgerMap[p.id];
    // fallback: infer from stored fields
    const balance = p.balance || 0;
    return {
      balance,
      totalCharged: balance > 0 ? balance : 0,
      totalPaid: 0,
      status: balance <= 0 ? 'paid' : p.payment_status || 'unpaid',
      claims: [],
      payments: [],
    };
  };

  const summary = useMemo(() => {
    const activePlayers = players.filter(p => p.status !== 'archived');
    let totalOwed = 0, paid = 0, unpaid = 0, partial = 0, overdue = 0;
    for (const p of activePlayers) {
      const l = getLedger(p);
      if (l.balance > 0) totalOwed += l.balance;
      if (l.status === 'paid') paid++;
      else if (l.status === 'unpaid') unpaid++;
      else if (l.status === 'partial') partial++;
      else if (l.status === 'overdue') overdue++;
    }
    return { totalOwed, paid, unpaid, partial, overdue };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, ledgerMap]);

  const validateForm = () => {
    const errors = {};
    if (!form.full_name.trim()) errors.full_name = 'Navn er påkrevd';
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.user_email.trim() && !emailRe.test(form.user_email)) errors.user_email = 'Ugyldig e-postformat';
    return errors;
  };

  const openNew = () => {
    setEditData(null);
    setForm({ full_name: '', user_email: '', role: 'player', balance: '0', phone: '', notes: '' });
    setFormErrors({});
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditData(p);
    setForm({ 
      full_name: p.full_name, 
      user_email: p.user_email, 
      role: p.role, 
      balance: String(p.balance || 0),
      phone: p.phone || '',
      notes: p.notes || ''
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleSave = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setSaving(true);
    const data = {
      team_id: currentTeam.id,
      full_name: form.full_name,
      user_email: form.user_email,
      role: form.role,
      balance: Number(form.balance) || 0,
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
    setFormErrors({});
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

  const handleSendReminder = async (player) => {
    setSendingReminder(player.id);
    const ledger = getLedger(player);
    try {
      await base44.integrations.Core.SendEmail({
        to: player.user_email,
        subject: `Betalingspåminnelse – ${currentTeam.name}`,
        body: `Hei ${player.full_name},\n\nDu har ${formatNOK(ledger.balance)} utestående for ${currentTeam.name}.\n\nVennligst betal til kasserer.\n\nMvh\n${currentTeam.name}`,
      });
      alert(`Påminnelse sendt til ${player.full_name}`);
    } catch (e) {
      alert('Feil ved sending: ' + e.message);
    }
    setSendingReminder(null);
  };

  if (!currentTeam) return <p className="text-center py-12 text-slate-500">Velg et lag for å se spillere.</p>;

  // Debug panel — only in development or when 0 players returned for admin
  const showDebug = isAdmin && !isLoading && players.length === 0;

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['players', currentTeam?.id] });
  };

  // Non-admin (forelder/spiller): show only OWN profile, no other players' finances
  if (!isAdmin) {
    const myProfile = playerProfile || players.find(p => p.user_email === user?.email);
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-6 max-w-2xl">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Min profil</h1>
            <p className="text-sm text-slate-500">Din profil for {currentTeam.name}</p>
          </div>

          {myProfile ? (
            <PlayerProfileCard
              player={myProfile}
              ledger={getLedger(myProfile)}
              onUpdate={() => queryClient.invalidateQueries({ queryKey: ['players'] })}
              isOwnProfile={true}
            />
          ) : (
            <Card className="border-0 shadow-md dark:bg-slate-900">
              <CardContent className="p-8 text-center text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Ingen profil funnet for dette laget.</p>
                <p className="text-xs mt-1">Ta kontakt med administrator.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </PullToRefresh>
    );
  }

  // Admin view
  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spillere & Betalinger</h1>
          <p className="text-sm text-slate-500">{players.length} spillere registrert</p>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" /> Legg til spiller/forelder
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-0 shadow-md dark:bg-slate-900 col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Totalt utestående</p>
            <p className="text-xl font-bold text-red-600">{formatNOK(summary.totalOwed)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Betalt</p>
            <p className="text-xl font-bold text-emerald-600">{summary.paid}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Delvis</p>
            <p className="text-xl font-bold text-amber-600">{summary.partial}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Ubetalt</p>
            <p className="text-xl font-bold text-red-600">{summary.unpaid}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Forfalt</p>
            <p className="text-xl font-bold text-rose-700">{summary.overdue}</p>
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
              ) : playersError ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-red-500 text-sm">Feil ved lasting: {playersError?.message}</TableCell></TableRow>
              ) : players.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12">
                  <p className="text-slate-400">Ingen spillere lagt til</p>
                  {showDebug && (
                    <p className="text-xs text-amber-600 mt-2">
                      Debug: teamId={currentTeam.id} role={currentTeamRole} isAdmin={String(isAdmin)} — 0 players returned fra getTeamPlayers
                    </p>
                  )}
                </TableCell></TableRow>
              ) : players.filter(p => p.status !== 'archived').map(p => {
                const l = getLedger(p);
                const cfg = STATUS_CONFIG[l.status] || STATUS_CONFIG.paid;
                const needsReminder = l.status === 'unpaid' || l.status === 'partial' || l.status === 'overdue';
                return (
                  <TableRow key={p.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer" onClick={() => setSelectedPlayer(p)}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell className="text-sm text-slate-500">{p.user_email}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badgeClass}`}>{cfg.label}</span>
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${l.balance > 0 ? 'text-red-600' : l.balance < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {l.balance > 0 ? `-${formatNOK(l.balance)}` : l.balance < 0 ? `+${formatNOK(Math.abs(l.balance))}` : '–'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {p.role === 'parent' ? 'Forelder' : 'Spiller'}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {needsReminder && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => handleSendReminder(p)} disabled={sendingReminder === p.id}>
                            {sendingReminder === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleInvite(p)} disabled={inviting}>
                          <Mail className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}>
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

      {/* Player details modal */}
      <Dialog open={!!selectedPlayer} onOpenChange={() => setSelectedPlayer(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPlayer && (() => {
            const l = getLedger(selectedPlayer);
            const cfg = STATUS_CONFIG[l.status] || STATUS_CONFIG.paid;
            const needsReminder = l.status !== 'paid';
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl">{selectedPlayer.full_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                  {/* Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">E-post</p>
                      <p className="font-medium text-sm">{selectedPlayer.user_email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Telefon</p>
                      <p className="font-medium text-sm">{selectedPlayer.phone || '–'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Rolle</p>
                      <Badge variant="secondary" className="text-xs">{selectedPlayer.role === 'parent' ? 'Forelder' : 'Spiller'}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Ledger-status</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badgeClass}`}>{cfg.label}</span>
                    </div>
                  </div>

                  {/* Ledger breakdown – "Kilder til saldo" */}
                  <div>
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-500" /> Kilder til saldo
                    </h3>
                    <PlayerLedgerDetail ledger={l} />
                  </div>

                  {/* Vipps payment actions */}
                  {needsReminder && (
                    <div>
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 text-orange-500" /> Vipps betalingslenker
                      </h3>
                      <VippsClaimActions claims={l.claims} teamId={currentTeam?.id} />
                    </div>
                  )}

                  {/* Actions */}
                  {needsReminder && (
                    <Button onClick={() => handleSendReminder(selectedPlayer)} disabled={sendingReminder === selectedPlayer.id} className="w-full bg-amber-600 hover:bg-amber-700 gap-2">
                      {sendingReminder === selectedPlayer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                      Send betalingspåminnelse
                    </Button>
                  )}

                  {selectedPlayer.notes && (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm">
                      <p className="text-xs text-slate-500 mb-1">Notater</p>
                      <p>{selectedPlayer.notes}</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editData ? 'Rediger spiller' : 'Legg til spiller'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fullt navn *</Label>
                <Input value={form.full_name} onChange={e => { setForm({ ...form, full_name: e.target.value }); setFormErrors(fe => ({ ...fe, full_name: undefined })); }} className={formErrors.full_name ? 'border-red-400' : ''} />
                {formErrors.full_name && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.full_name}</p>}
              </div>
              <div className="space-y-2">
                <Label>E-post</Label>
                <Input type="email" value={form.user_email} onChange={e => { setForm({ ...form, user_email: e.target.value }); setFormErrors(fe => ({ ...fe, user_email: undefined })); }} className={formErrors.user_email ? 'border-red-400' : ''} />
                {formErrors.user_email && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.user_email}</p>}
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
                <Input value={form.phone} onChange={e => { setForm({ ...form, phone: e.target.value }); setFormErrors(fe => ({ ...fe, phone: undefined })); }} className={formErrors.phone ? 'border-red-400' : ''} placeholder="+47 12345678" />
                {formErrors.phone && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.phone}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Startsaldo (NOK) – overstyres av krav/innbetalinger</Label>
              <Input type="number" step="0.01" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Interne notater</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Avbryt</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editData ? 'Oppdater' : 'Lagre'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </PullToRefresh>
  );
}