import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useTeam } from '@/components/shared/TeamContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import RoleManagement from '@/components/settings/RoleManagement';
import TeamMembersManager from '@/components/settings/TeamMembersManager';
import AlertThresholdSettings from '@/components/notifications/AlertThresholdSettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NativeSelect from '@/components/mobile/NativeSelect';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Save, Trash2, Shield, AlertTriangle, Loader2, CheckCircle, Users, Eye, EyeOff, Tag, Plus as PlusIcon, Pencil, UserX, Copy, RefreshCw, Bell, BellOff, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const SPORTS = ['Fotball', 'Håndball', 'Ski', 'Svømming', 'Friidrett', 'Basketball', 'Volleyball', 'Ishockey', 'Tennis', 'Annet'];

export default function SettingsPage() {
  const { currentTeam, refreshTeams, user, currentTeamRole } = useTeam();
  const queryClient = useQueryClient();

  // All hooks at top level - call useQuery before any conditional logic
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam?.id,
    staleTime: 60000,
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', currentTeam?.id],
    queryFn: () => base44.entities.Budget.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam?.id,
    staleTime: 60000,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam?.id) return [];
      return base44.entities.Category.filter({ team_id: currentTeam.id });
    },
    enabled: !!currentTeam?.id,
    staleTime: 30000,
  });

  const [form, setForm] = useState(currentTeam ? {
    name: currentTeam.name,
    sport_type: currentTeam.sport_type,
    estimated_members: String(currentTeam.estimated_members || ''),
    nif_number: currentTeam.nif_number || '',
    show_player_names: currentTeam.show_player_names !== false,
  } : {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem('push_notifications_enabled') === 'true');
  const [pushDismissed, setPushDismissed] = useState(() => localStorage.getItem('push_prompt_dismissed') === 'true');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'expense' });
  const [savingCategory, setSavingCategory] = useState(false);

  const handleSave = async () => {
    if (!currentTeam) return;
    setSaving(true);
    await base44.entities.Team.update(currentTeam.id, {
      ...form,
      estimated_members: Number(form.estimated_members) || 0,
    });
    await refreshTeams();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleInvite = async () => {
    if (!inviteEmail || !currentTeam) return;
    const members = [...(currentTeam.members || [])];
    if (members.find(m => m.email === inviteEmail)) return;
    members.push({ email: inviteEmail, role: inviteRole });
    await base44.entities.Team.update(currentTeam.id, { members });
    await refreshTeams();
    setInviteEmail('');
  };

  const removeMember = async (email) => {
    if (!currentTeam) return;
    const members = (currentTeam.members || []).filter(m => m.email !== email);
    await base44.entities.Team.update(currentTeam.id, { members });
    await refreshTeams();
  };

  const handleDeleteTeam = async () => {
    if (deleteConfirm !== currentTeam?.name) return;
    setDeleting(true);
    try {
      await base44.functions.invoke('deleteTeamData', { team_id: currentTeam.id });
      localStorage.removeItem('idrettsøkonomi_team_id');
      window.location.replace('/Onboarding');
    } catch (e) {
      toast.error('Noe gikk galt under sletting: ' + e.message);
      setDeleting(false);
    }
  };

  const openNewCategory = () => {
    setEditCategory(null);
    setCategoryForm({ name: '', type: 'expense' });
    setShowCategoryForm(true);
  };

  const openEditCategory = (cat) => {
    setEditCategory(cat);
    setCategoryForm({ name: cat.name, type: cat.type });
    setShowCategoryForm(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name) return;
    setSavingCategory(true);
    const data = { team_id: currentTeam.id, name: categoryForm.name, type: categoryForm.type, is_default: false };
    if (editCategory?.id) {
      await base44.entities.Category.update(editCategory.id, data);
    } else {
      await base44.entities.Category.create(data);
    }
    setSavingCategory(false);
    setShowCategoryForm(false);
    queryClient.invalidateQueries({ queryKey: ['categories', currentTeam?.id] });
  };

  const handleDeleteCategory = async (id) => {
    await base44.entities.Category.delete(id);
    queryClient.invalidateQueries({ queryKey: ['categories', currentTeam?.id] });
  };

  if (!currentTeam?.id) {
    try { localStorage.removeItem('idrettsøkonomi_team_id'); } catch {}
    window.location.replace('/Onboarding');
    return null;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Innstillinger</h1>
        <p className="text-sm text-slate-500">Administrer laget og kontoinnstillinger</p>
      </div>

      {/* Team Members / Access Management */}
      <TeamMembersManager />

      {/* Role management */}
      {currentTeamRole === 'admin' && (
        <RoleManagement teamId={currentTeam?.id} />
      )}

      {/* Alert threshold settings */}
      <AlertThresholdSettings teamId={currentTeam?.id} transactions={transactions} budgets={budgets} />

      {/* Team details */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" /> Laginformasjon
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Lagsnavn</Label>
            <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Idrettstype</Label>
            <NativeSelect
              value={form.sport_type || ''}
              onValueChange={v => setForm({ ...form, sport_type: v })}
              title="Idrettstype"
              options={SPORTS.map(s => ({ value: s, label: s }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Antall medlemmer</Label>
              <Input type="number" value={form.estimated_members || ''} onChange={e => setForm({ ...form, estimated_members: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>NIF-nummer</Label>
              <Input value={form.nif_number || ''} onChange={e => setForm({ ...form, nif_number: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Lagret!' : 'Lagre endringer'}
          </Button>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-500" /> Kategorier
              </CardTitle>
              <CardDescription>Tilpass inntekts- og utgiftskategorier</CardDescription>
            </div>
            <Button onClick={openNewCategory} size="sm" variant="outline" className="gap-2">
              <PlusIcon className="w-3.5 h-3.5" /> Ny
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['income', 'expense'].map(type => (
              <div key={type}>
                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">{type === 'income' ? 'Inntekter' : 'Utgifter'}</p>
                <div className="space-y-2">
                  {categories.filter(c => c.type === type).map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 group">
                      <span className="text-sm">{cat.name}</span>
                      {!cat.is_default && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditCategory(cat)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteCategory(cat.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {categories.filter(c => c.type === type).length === 0 && (
                    <p className="text-xs text-slate-400 py-2">Ingen kategorier lagt til</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Join code */}
      {currentTeamRole === 'admin' && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" /> Lagkode for selvinnmelding
            </CardTitle>
            <CardDescription>Del denne koden med spillere og foreldre så de kan melde seg inn selv</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-1">Lagkode</p>
                <p className="text-3xl font-mono font-bold tracking-widest text-emerald-600">{currentTeam.join_code || '—'}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(currentTeam.join_code || '');
                    toast.success('Kode kopiert!');
                  }}
                  disabled={!currentTeam.join_code}
                >
                  <Copy className="w-3.5 h-3.5" /> Kopier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={async () => {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                    let code = '';
                    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
                    await base44.entities.Team.update(currentTeam.id, { join_code: code });
                    await refreshTeams();
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Ny kode
                </Button>
              </div>
            </div>
            {!currentTeam.join_code && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                onClick={async () => {
                  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                  let code = '';
                  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
                  await base44.entities.Team.update(currentTeam.id, { join_code: code });
                  await refreshTeams();
                }}
              >
                <RefreshCw className="w-4 h-4" /> Generer lagkode
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Privacy settings */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {form.show_player_names ? <Eye className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-slate-500" />} Personvern
          </CardTitle>
          <CardDescription>Kontroller hva spillere/foreldre kan se</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div>
              <p className="font-medium text-sm">Vis spillernavn i betalingsstatus</p>
              <p className="text-xs text-slate-500 mt-1">Hvis av, vises kun "Spiller A", "Spiller B", etc.</p>
            </div>
            <Switch 
              checked={form.show_player_names} 
              onCheckedChange={v => setForm({ ...form, show_player_names: v })} 
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Lagret!' : 'Lagre endringer'}
          </Button>
        </CardContent>
      </Card>



      {/* Subscription */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base">Abonnement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div>
              <p className="font-medium">
                Status: <Badge variant="secondary" className={
                  currentTeam.subscription_status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                  currentTeam.subscription_status === 'trial' ? 'bg-blue-100 text-blue-800' :
                  'bg-red-100 text-red-800'
                }>
                  {currentTeam.subscription_status === 'active' ? 'Aktiv' :
                   currentTeam.subscription_status === 'trial' ? 'Prøveperiode' : 'Utløpt'}
                </Badge>
              </p>
              <p className="text-sm text-slate-500 mt-1">89 kr/mnd per lag – Moms inkludert</p>
            </div>
            {(currentTeam.subscription_status === 'trial' || currentTeam.subscription_status === 'expired') && (
              <Button className="bg-emerald-600 hover:bg-emerald-700">Oppgrader nå</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Push notifications */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-500" /> Push-varsler
          </CardTitle>
          <CardDescription>Styrer nettleservarsler for betalinger og arrangementer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div>
              <p className="font-medium text-sm">Status: {pushEnabled ? <span className="text-emerald-600">På</span> : <span className="text-slate-500">Av</span>}</p>
              <p className="text-xs text-slate-500 mt-1">{pushEnabled ? 'Du mottar push-varsler' : 'Push-varsler er deaktivert'}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (pushEnabled) {
                  localStorage.setItem('push_notifications_enabled', 'false');
                  localStorage.setItem('push_prompt_dismissed', 'true');
                  setPushEnabled(false);
                  toast.success('Push-varsler deaktivert');
                } else {
                  localStorage.setItem('push_prompt_dismissed', 'false');
                  setPushDismissed(false);
                  toast.info('Gå til forsiden for å aktivere push-varsler');
                }
              }}
            >
              {pushEnabled ? <><BellOff className="w-4 h-4" /> Deaktiver</> : <><Bell className="w-4 h-4" /> Aktiver</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LogOut className="w-4 h-4 text-slate-500" /> Logg ut
          </CardTitle>
          <CardDescription>Avslutt økten og logg ut av applikasjonen</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => { localStorage.clear(); base44.auth.logout(); }} className="gap-2">
            <LogOut className="w-4 h-4" /> Logg ut
          </Button>
        </CardContent>
      </Card>

      {/* Delete account */}
      <Card className="border-0 shadow-md border-red-200 dark:border-red-500/20 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base text-red-600 flex items-center gap-2">
            <UserX className="w-4 h-4" /> Slett min konto
          </CardTitle>
          <CardDescription>Sletter din brukerkonto permanent. Du mister tilgang til alle lag.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setShowDeleteAccount(true)} className="gap-2">
            <UserX className="w-4 h-4" /> Slett konto
          </Button>
        </CardContent>
      </Card>

      {/* GDPR / Delete team */}
      <Card className="border-0 shadow-md border-red-200 dark:border-red-500/20 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Faresone
          </CardTitle>
          <CardDescription>GDPR: Du kan slette all data knyttet til dette laget permanent.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setShowDelete(true)} className="gap-2">
            <Trash2 className="w-4 h-4" /> Slett lag og all data
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editCategory ? 'Rediger kategori' : 'Ny kategori'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Navn</Label>
              <Input value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="F.eks. Cupper" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <NativeSelect
                value={categoryForm.type}
                onValueChange={v => setCategoryForm({ ...categoryForm, type: v })}
                title="Type"
                options={[{ value: 'income', label: 'Inntekt' }, { value: 'expense', label: 'Utgift' }]}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCategoryForm(false)} className="flex-1">Avbryt</Button>
              <Button onClick={handleSaveCategory} disabled={savingCategory || !categoryForm.name} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {savingCategory ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Lagre
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteAccount} onOpenChange={setShowDeleteAccount}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Slett din konto?</DialogTitle>
            <DialogDescription>
              Dette vil permanent slette din brukerkonto. Skriv "SLETT" for å bekrefte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input value={deleteAccountConfirm} onChange={e => setDeleteAccountConfirm(e.target.value)} placeholder="SLETT" />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDeleteAccount(false)} className="flex-1">Avbryt</Button>
              <Button variant="destructive" disabled={deleteAccountConfirm !== 'SLETT' || deletingAccount} className="flex-1"
                onClick={async () => {
                  setDeletingAccount(true);
                  await base44.auth.logout('/');
                }}>
                {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Slett permanent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Slett {currentTeam.name}?</DialogTitle>
            <DialogDescription>
              Dette vil permanent slette laget og ALL tilknyttet data (transaksjoner, spillere, krav, arrangementer, budsjett osv.). Denne handlingen kan ikke angres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label>Skriv lagnavnet for å bekrefte: <strong>{currentTeam.name}</strong></Label>
            <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={currentTeam.name} />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDelete(false)} className="flex-1">Avbryt</Button>
              <Button variant="destructive" onClick={handleDeleteTeam} disabled={deleteConfirm !== currentTeam.name || deleting} className="flex-1">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Slett permanent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}