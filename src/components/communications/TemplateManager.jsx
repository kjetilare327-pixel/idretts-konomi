import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';

export default function TemplateManager({ teamId, onSelectTemplate }) {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'custom',
    subject: '',
    body: ''
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates', teamId],
    queryFn: () => base44.entities.CommunicationTemplate.filter({ team_id: teamId, is_active: true }),
    enabled: !!teamId,
  });

  const handleSave = async () => {
    if (editing) {
      await base44.entities.CommunicationTemplate.update(editing.id, form);
    } else {
      await base44.entities.CommunicationTemplate.create({
        ...form,
        team_id: teamId,
        is_active: true
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ['templates'] });
    setShowDialog(false);
    resetForm();
  };

  const handleDelete = async (id) => {
    if (confirm('Er du sikker på at du vil slette denne malen?')) {
      await base44.entities.CommunicationTemplate.update(id, { is_active: false });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    }
  };

  const handleEdit = (template) => {
    setEditing(template);
    setForm({
      name: template.name,
      type: template.type,
      subject: template.subject,
      body: template.body
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ name: '', type: 'custom', subject: '', body: '' });
  };

  const typeLabels = {
    payment_reminder: 'Betalingspåminnelse',
    volunteer_invitation: 'Dugnadsinvitasjon',
    event_notification: 'Arrangementsvarsel',
    welcome: 'Velkomstmelding',
    custom: 'Egendefinert'
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Meldingsmaler</h3>
        <Button
          size="sm"
          onClick={() => { resetForm(); setShowDialog(true); }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Ny mal
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {templates.map(template => (
          <div key={template.id} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-900 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-medium text-sm">{template.name}</h4>
                <Badge variant="outline" className="mt-1 text-xs">
                  {typeLabels[template.type]}
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelectTemplate?.(template)}
                  className="h-7 w-7 p-0"
                >
                  <FileText className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(template)}
                  className="h-7 w-7 p-0"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(template.id)}
                  className="h-7 w-7 p-0 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{template.subject}</p>
            <p className="text-xs text-slate-500 line-clamp-2">{template.body.substring(0, 100)}...</p>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <p className="text-center py-8 text-slate-500 text-sm">Ingen maler ennå. Opprett din første mal!</p>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Rediger mal' : 'Opprett mal'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Navn på mal</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  placeholder="F.eks. Månedlig kontingentpåminnelse"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Emne</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({...form, subject: e.target.value})}
                placeholder="E-post emne"
              />
            </div>
            <div className="space-y-2">
              <Label>Meldingsinnhold</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({...form, body: e.target.value})}
                placeholder="Skriv meldingen her..."
                rows={10}
              />
              <p className="text-xs text-slate-500">
                Variabler: {'{'}{'{'} name {'}'}{'}'}, {'{'}{'{'} amount {'}'}{'}'}, {'{'}{'{'} date {'}'}{'}'}, {'{'}{'{'} event {'}'}{'}'}, {'{'}{'{'} team {'}'}{'}'}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">
                Avbryt
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.name || !form.subject || !form.body}
                className="flex-1"
              >
                {editing ? 'Oppdater' : 'Opprett'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}