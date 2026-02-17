import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Shield } from 'lucide-react';

const PERMISSIONS = [
  { id: 'view_dashboard', label: 'Se dashbord', category: 'Oversikt' },
  { id: 'view_transactions', label: 'Se transaksjoner', category: 'Transaksjoner' },
  { id: 'create_transaction', label: 'Opprett transaksjoner', category: 'Transaksjoner' },
  { id: 'edit_transaction', label: 'Rediger transaksjoner', category: 'Transaksjoner' },
  { id: 'delete_transaction', label: 'Slett transaksjoner', category: 'Transaksjoner' },
  { id: 'view_budget', label: 'Se budsjett', category: 'Budsjett' },
  { id: 'create_budget', label: 'Opprett budsjett', category: 'Budsjett' },
  { id: 'edit_budget', label: 'Rediger budsjett', category: 'Budsjett' },
  { id: 'delete_budget', label: 'Slett budsjett', category: 'Budsjett' },
  { id: 'view_claims', label: 'Se fordringer', category: 'Fordringer' },
  { id: 'create_claim', label: 'Opprett fordringer', category: 'Fordringer' },
  { id: 'edit_claim', label: 'Rediger fordringer', category: 'Fordringer' },
  { id: 'delete_claim', label: 'Slett fordringer', category: 'Fordringer' },
  { id: 'view_players', label: 'Se medlemmer', category: 'Medlemmer' },
  { id: 'edit_player', label: 'Rediger medlemmer', category: 'Medlemmer' },
  { id: 'view_reports', label: 'Se rapporter', category: 'Rapporter' },
  { id: 'export_reports', label: 'Eksporter rapporter', category: 'Rapporter' },
  { id: 'view_bank_reconciliation', label: 'Se bankavstemminger', category: 'Bank' },
  { id: 'manage_bank_matching', label: 'Administrer bankmatching', category: 'Bank' },
  { id: 'view_analytics', label: 'Se analytics', category: 'Analyse' },
  { id: 'manage_roles', label: 'Administrer roller', category: 'Admin' },
  { id: 'manage_team_settings', label: 'Administrer laginnnstillinger', category: 'Admin' },
  { id: 'invite_members', label: 'Inviter medlemmer', category: 'Admin' },
  { id: 'remove_members', label: 'Fjern medlemmer', category: 'Admin' }
];

export default function RoleManagement({ teamId }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ role_name: '', description: '', permissions: [] });
  const queryClient = useQueryClient();

  const { data: roles = [] } = useQuery({
    queryKey: ['roleDefinitions', teamId],
    queryFn: () => base44.entities.RoleDefinition.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const handleCreate = async () => {
    if (!form.role_name || form.permissions.length === 0) return;
    
    await base44.entities.RoleDefinition.create({
      team_id: teamId,
      ...form
    });

    setShowForm(false);
    setForm({ role_name: '', description: '', permissions: [] });
    queryClient.invalidateQueries({ queryKey: ['roleDefinitions'] });
  };

  const handleDelete = async (id) => {
    if (!confirm('Slett denne rollen?')) return;
    await base44.entities.RoleDefinition.delete(id);
    queryClient.invalidateQueries({ queryKey: ['roleDefinitions'] });
  };

  const togglePermission = (permId) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const permissionsByCategory = PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Tilgangskontroll</CardTitle>
              <CardDescription>
                Definer tilpassede roller med spesifikke tillatelser
              </CardDescription>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Ny rolle
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {roles.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            Ingen tilpassede roller opprettet ennå
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map(role => (
              <div key={role.id} className="p-4 rounded-lg border bg-white dark:bg-slate-900">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{role.role_name}</h3>
                    {role.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {role.description}
                      </p>
                    )}
                  </div>
                  {!role.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(role.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {role.permissions?.slice(0, 5).map(perm => (
                    <Badge key={perm} variant="secondary" className="text-xs">
                      {PERMISSIONS.find(p => p.id === perm)?.label || perm}
                    </Badge>
                  ))}
                  {role.permissions?.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{role.permissions.length - 5} mer
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Opprett ny rolle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Rollenavn</Label>
              <Input
                value={form.role_name}
                onChange={(e) => setForm({...form, role_name: e.target.value})}
                placeholder="F.eks. Regnskapsfører"
              />
            </div>

            <div className="space-y-2">
              <Label>Beskrivelse</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({...form, description: e.target.value})}
                placeholder="Valgfri beskrivelse"
              />
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Tillatelser</Label>
              {Object.entries(permissionsByCategory).map(([category, perms]) => (
                <div key={category} className="space-y-3 p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50">
                  <h4 className="font-medium text-sm">{category}</h4>
                  <div className="space-y-2">
                    {perms.map(perm => (
                      <div key={perm.id} className="flex items-center gap-3">
                        <Checkbox
                          checked={form.permissions.includes(perm.id)}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        <Label className="text-sm font-normal">{perm.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                Avbryt
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!form.role_name || form.permissions.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Opprett rolle
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}