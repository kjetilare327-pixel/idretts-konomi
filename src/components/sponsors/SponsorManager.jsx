import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatNOK, formatDate } from '@/components/shared/FormatUtils';
import { Plus, Pencil, Trash2, AlertCircle, CheckCircle2, Clock, Building2, HandCoins } from 'lucide-react';

const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  cancelled: 'bg-slate-100 text-slate-500',
};

const PAY_STATUS_COLORS = {
  paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
};

const EMPTY_FORM = {
  name: '', type: 'sponsor', contact_name: '', contact_email: '', contact_phone: '',
  amount: '', payment_schedule: 'yearly', agreement_start: '', agreement_end: '',
  next_payment_date: '', status: 'active', payment_status: 'pending',
  description: '', notes: '', grant_organization: '', application_deadline: '', application_status: 'not_applied',
};

export default function SponsorManager({ teamId }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const { data: sponsors = [] } = useQuery({
    queryKey: ['sponsors', teamId],
    queryFn: () => base44.entities.Sponsor.filter({ team_id: teamId }),
    enabled: !!teamId,
  });

  const today = new Date().toISOString().split('T')[0];

  const filtered = sponsors.filter(s => {
    if (filter === 'all') return true;
    return s.type === filter;
  });

  // Alerts: expiring within 60 days or overdue payments
  const alerts = sponsors.filter(s => {
    if (!s.agreement_end) return false;
    const daysLeft = Math.floor((new Date(s.agreement_end) - new Date()) / (1000 * 60 * 60 * 24));
    return (daysLeft >= 0 && daysLeft <= 60) || s.payment_status === 'overdue';
  });

  const totalActive = sponsors.filter(s => s.status === 'active').reduce((sum, s) => sum + s.amount, 0);
  const totalSponsors = sponsors.filter(s => s.type === 'sponsor' && s.status === 'active').length;
  const totalGrants = sponsors.filter(s => s.type === 'grant' && s.status === 'active').length;

  const openNew = () => { setEditData(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (s) => {
    setEditData(s);
    setForm({ ...EMPTY_FORM, ...s });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.amount) return;
    setSaving(true);
    const data = { ...form, team_id: teamId, amount: Number(form.amount) };
    if (editData?.id) await base44.entities.Sponsor.update(editData.id, data);
    else await base44.entities.Sponsor.create(data);
    setSaving(false);
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['sponsors', teamId] });
  };

  const handleDelete = async (id) => {
    await base44.entities.Sponsor.delete(id);
    queryClient.invalidateQueries({ queryKey: ['sponsors', teamId] });
  };

  const markPaid = async (s) => {
    await base44.entities.Sponsor.update(s.id, { payment_status: 'paid' });
    queryClient.invalidateQueries({ queryKey: ['sponsors', teamId] });
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Totalt aktive avtaler', value: formatNOK(totalActive), color: 'emerald' },
          { label: 'Aktive sponsorer', value: totalSponsors, color: 'blue', suffix: 'stk' },
          { label: 'Aktive tilskudd', value: totalGrants, color: 'purple', suffix: 'stk' },
          { label: 'Varsler', value: alerts.length, color: alerts.length > 0 ? 'red' : 'slate', suffix: 'stk' },
        ].map(item => (
          <Card key={item.label} className="border-0 shadow-sm dark:bg-slate-900">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">{item.label}</p>
              <p className={`text-xl font-bold text-${item.color}-600`}>
                {item.value}{item.suffix ? ` ${item.suffix}` : ''}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(s => {
            const daysLeft = s.agreement_end ? Math.floor((new Date(s.agreement_end) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            return (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  {s.payment_status === 'overdue' && <span className="text-red-700 dark:text-red-400 font-medium">{s.name}: Betaling er forfalt – {formatNOK(s.amount)}</span>}
                  {daysLeft !== null && daysLeft <= 60 && daysLeft >= 0 && (
                    <span className="text-amber-700 dark:text-amber-400 font-medium block">{s.name}: Avtalen utløper om {daysLeft} dager ({formatDate(s.agreement_end)})</span>
                  )}
                </div>
                {s.payment_status === 'overdue' && (
                  <Button size="sm" variant="outline" className="ml-auto shrink-0 h-7" onClick={() => markPaid(s)}>Marker betalt</Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {['all', 'sponsor', 'grant', 'partner'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {f === 'all' ? 'Alle' : f === 'sponsor' ? 'Sponsorer' : f === 'grant' ? 'Tilskudd' : 'Partnere'}
            </button>
          ))}
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Plus className="w-4 h-4" /> Legg til
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Ingen sponsorer/tilskudd registrert ennå</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const daysLeft = s.agreement_end ? Math.floor((new Date(s.agreement_end) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            return (
              <Card key={s.id} className="border-0 shadow-sm dark:bg-slate-900 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${s.type === 'grant' ? 'bg-purple-50 dark:bg-purple-500/10' : 'bg-blue-50 dark:bg-blue-500/10'}`}>
                        {s.type === 'grant' ? <HandCoins className="w-5 h-5 text-purple-600" /> : <Building2 className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{s.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status]}`}>
                            {s.status === 'active' ? 'Aktiv' : s.status === 'pending' ? 'Venter' : s.status === 'expired' ? 'Utløpt' : 'Kansellert'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAY_STATUS_COLORS[s.payment_status] || ''}`}>
                            {s.payment_status === 'paid' ? 'Betalt' : s.payment_status === 'overdue' ? 'Forfalt' : 'Venter betaling'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                          {s.contact_name && <span>{s.contact_name}</span>}
                          {s.contact_email && <span>{s.contact_email}</span>}
                          {s.agreement_end && <span className={daysLeft !== null && daysLeft <= 30 ? 'text-red-500 font-medium' : ''}>Utløper: {formatDate(s.agreement_end)}{daysLeft !== null && daysLeft >= 0 ? ` (${daysLeft}d)` : ''}</span>}
                          {s.next_payment_date && <span>Neste betaling: {formatDate(s.next_payment_date)}</span>}
                        </div>
                        {s.description && <p className="text-xs text-slate-400 mt-1">{s.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">{formatNOK(s.amount)}</p>
                        <p className="text-xs text-slate-400">{s.payment_schedule === 'yearly' ? '/år' : s.payment_schedule === 'monthly' ? '/mnd' : s.payment_schedule === 'quarterly' ? '/kvartal' : 'engangsbetaling'}</p>
                      </div>
                      <div className="flex gap-1">
                        {s.payment_status !== 'paid' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" title="Marker betalt" onClick={() => markPaid(s)}>
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editData ? 'Rediger' : 'Ny sponsor / tilskudd'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type *</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sponsor">Sponsor</SelectItem>
                    <SelectItem value="grant">Tilskudd</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="pending">Venter</SelectItem>
                    <SelectItem value="expired">Utløpt</SelectItem>
                    <SelectItem value="cancelled">Kansellert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Navn *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Navn på sponsor/tilskuddsgiver" className="h-9" />
            </div>
            {form.type === 'grant' && (
              <div className="space-y-1">
                <Label className="text-xs">Tilskuddorganisasjon</Label>
                <Input value={form.grant_organization} onChange={e => setForm({ ...form, grant_organization: e.target.value })} className="h-9" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Beløp (NOK) *</Label>
                <Input type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Betalingsfrekvens</Label>
                <Select value={form.payment_schedule} onValueChange={v => setForm({ ...form, payment_schedule: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Engangsbetaling</SelectItem>
                    <SelectItem value="monthly">Månedlig</SelectItem>
                    <SelectItem value="quarterly">Kvartalsvis</SelectItem>
                    <SelectItem value="yearly">Årlig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Avtalens start</Label>
                <Input type="date" value={form.agreement_start} onChange={e => setForm({ ...form, agreement_start: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Avtalens slutt</Label>
                <Input type="date" value={form.agreement_end} onChange={e => setForm({ ...form, agreement_end: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Neste betaling</Label>
                <Input type="date" value={form.next_payment_date} onChange={e => setForm({ ...form, next_payment_date: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Betalingsstatus</Label>
                <Select value={form.payment_status} onValueChange={v => setForm({ ...form, payment_status: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Betalt</SelectItem>
                    <SelectItem value="pending">Venter</SelectItem>
                    <SelectItem value="overdue">Forfalt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kontaktperson</Label>
                <Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-post</Label>
                <Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} className="h-9" />
              </div>
            </div>
            {form.type === 'grant' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Søknadsfrist</Label>
                  <Input type="date" value={form.application_deadline} onChange={e => setForm({ ...form, application_deadline: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Søknadsstatus</Label>
                  <Select value={form.application_status} onValueChange={v => setForm({ ...form, application_status: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_applied">Ikke søkt</SelectItem>
                      <SelectItem value="applied">Søkt</SelectItem>
                      <SelectItem value="approved">Godkjent</SelectItem>
                      <SelectItem value="rejected">Avslått</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Notater</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="h-9" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Avbryt</Button>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.amount} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Lagrer...' : 'Lagre'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}