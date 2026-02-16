import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { CalendarIcon, Upload, Loader2, X } from 'lucide-react';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/components/shared/FormatUtils';

export default function TransactionForm({ teamId, editData, onClose, onSaved }) {
  const [form, setForm] = useState(editData || {
    type: 'expense',
    category: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    attachment_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, attachment_url: file_url }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.category || !form.amount || !form.date) return;
    setSaving(true);
    const data = {
      ...form,
      team_id: teamId,
      amount: Math.abs(Number(form.amount)),
    };
    if (editData?.id) {
      await base44.entities.Transaction.update(editData.id, data);
    } else {
      await base44.entities.Transaction.create(data);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={v => setForm({ ...form, type: v, category: '' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Inntekt</SelectItem>
              <SelectItem value="expense">Utgift</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Kategori *</Label>
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue placeholder="Velg..." /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Beløp (NOK) *</Label>
          <Input type="number" min="0" step="1" placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Dato *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.date ? format(new Date(form.date), 'PPP', { locale: nb }) : 'Velg dato'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={form.date ? new Date(form.date) : undefined} onSelect={d => setForm({ ...form, date: d ? format(d, 'yyyy-MM-dd') : '' })} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Beskrivelse</Label>
        <Textarea placeholder="Valgfri beskrivelse..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
      </div>

      <div className="space-y-2">
        <Label>Vedlegg (bilde/PDF)</Label>
        {form.attachment_url ? (
          <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <a href={form.attachment_url} target="_blank" rel="noopener" className="text-sm text-emerald-600 truncate flex-1">
              Vedlegg lastet opp ✓
            </a>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setForm({ ...form, attachment_url: '' })}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            <Button variant="outline" className="w-full gap-2" disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Laster opp...' : 'Last opp fil'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Avbryt</Button>
        <Button onClick={handleSave} disabled={saving || !form.category || !form.amount || !form.date} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {editData?.id ? 'Oppdater' : 'Lagre'}
        </Button>
      </div>
    </div>
  );
}