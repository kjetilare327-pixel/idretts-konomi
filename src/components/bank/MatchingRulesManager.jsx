import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, CheckCircle2, Settings } from 'lucide-react';

export default function MatchingRulesManager({ teamId }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    pattern: '',
    category: '',
    type: 'expense',
    auto_approve: false,
    priority: 100
  });
  const queryClient = useQueryClient();

  const { data: rules = [] } = useQuery({
    queryKey: ['matching-rules', teamId],
    queryFn: () => base44.entities.BankMatchingRule.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', teamId],
    queryFn: () => base44.entities.Category.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const handleCreate = async () => {
    await base44.entities.BankMatchingRule.create({
      ...form,
      team_id: teamId
    });
    
    setShowForm(false);
    setForm({ name: '', pattern: '', category: '', type: 'expense', auto_approve: false, priority: 100 });
    queryClient.invalidateQueries({ queryKey: ['matching-rules'] });
  };

  const handleDelete = async (id) => {
    if (!confirm('Slett denne regelen?')) return;
    await base44.entities.BankMatchingRule.delete(id);
    queryClient.invalidateQueries({ queryKey: ['matching-rules'] });
  };

  const handleToggle = async (rule) => {
    await base44.entities.BankMatchingRule.update(rule.id, {
      is_active: !rule.is_active
    });
    queryClient.invalidateQueries({ queryKey: ['matching-rules'] });
  };

  const activeRules = rules.filter(r => r.is_active).sort((a, b) => a.priority - b.priority);
  const inactiveRules = rules.filter(r => !r.is_active);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Automatiske matchingsregler</CardTitle>
              <CardDescription>
                Sett opp regler for å automatisk kategorisere gjentakende transaksjoner
              </CardDescription>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2 bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4" />
            Ny regel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <p className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-2">
            Slik fungerer regler:
          </p>
          <ul className="text-sm text-purple-800 dark:text-purple-300 space-y-1">
            <li>• Regler kjøres i prioritetsrekkefølge (lavere nummer først)</li>
            <li>• Bruk * som wildcard (f.eks. "Vipps*" matcher alle Vipps-transaksjoner)</li>
            <li>• Første regel som matcher brukes</li>
            <li>• Auto-godkjenn betyr at transaksjonen godkjennes uten gjennomgang</li>
          </ul>
        </div>

        {activeRules.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead>Pri</TableHead>
                  <TableHead>Navn</TableHead>
                  <TableHead>Mønster</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Auto-godkjenn</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRules.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono text-sm">{rule.priority}</TableCell>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell className="font-mono text-sm">{rule.pattern}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{rule.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.type === 'income' ? 'default' : 'outline'}>
                        {rule.type === 'income' ? 'Inntekt' : 'Utgift'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rule.auto_approve && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(rule)}
                        >
                          Deaktiver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {inactiveRules.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
              Inaktive regler ({inactiveRules.length})
            </h3>
            <div className="space-y-2">
              {inactiveRules.map(rule => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50 opacity-60">
                  <div>
                    <span className="font-medium">{rule.name}</span>
                    <span className="text-sm text-slate-500 ml-2">{rule.pattern}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(rule)}
                  >
                    Aktiver
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeRules.length === 0 && inactiveRules.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            Ingen regler opprettet ennå
          </div>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Opprett ny matchingsregel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Navn på regel</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="F.eks. Vipps-transaksjoner"
              />
            </div>

            <div className="space-y-2">
              <Label>Søkemønster (* som wildcard)</Label>
              <Input
                value={form.pattern}
                onChange={(e) => setForm({...form, pattern: e.target.value})}
                placeholder="F.eks. Vipps* eller *medlemskontingent*"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue placeholder="Velg kategori" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Inntekt</SelectItem>
                    <SelectItem value="expense">Utgift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prioritet (lavere nummer = høyere prioritet)</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({...form, priority: parseInt(e.target.value) || 100})}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.auto_approve}
                onCheckedChange={(v) => setForm({...form, auto_approve: v})}
              />
              <Label>Godkjenn automatisk uten gjennomgang</Label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                Avbryt
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!form.name || !form.pattern || !form.category}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                Opprett regel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}