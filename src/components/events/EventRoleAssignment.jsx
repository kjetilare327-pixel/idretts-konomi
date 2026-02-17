import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X, UserCog } from 'lucide-react';

const COMMON_ROLES = [
  'Lagleder',
  'Assistent',
  'Dommer',
  'Lagfotograf',
  'Førstehjelpskontakt',
  'Utstyrsansvarlig',
  'Kaptein'
];

export default function EventRoleAssignment({ form, setForm, players }) {
  const [newRole, setNewRole] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');

  const addRole = () => {
    if (!newRole || !selectedPlayer) return;

    const player = players.find(p => p.id === selectedPlayer);
    if (!player) return;

    const assignedRoles = form.assigned_roles || [];
    assignedRoles.push({
      role: newRole,
      player_id: player.id,
      player_name: player.full_name
    });

    setForm({ ...form, assigned_roles: assignedRoles });
    setNewRole('');
    setSelectedPlayer('');
  };

  const removeRole = (index) => {
    const assignedRoles = [...(form.assigned_roles || [])];
    assignedRoles.splice(index, 1);
    setForm({ ...form, assigned_roles: assignedRoles });
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
      <div className="flex items-center gap-2">
        <UserCog className="w-5 h-5 text-indigo-500" />
        <h3 className="font-medium">Tildel roller for arrangementet</h3>
      </div>

      {/* Current roles */}
      {form.assigned_roles && form.assigned_roles.length > 0 && (
        <div className="space-y-2">
          {form.assigned_roles.map((role, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded border bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{role.role}</Badge>
                <span className="text-sm">{role.player_name}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeRole(index)}
                className="h-6 w-6 p-0 text-red-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new role */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Rolle</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue placeholder="Velg rolle" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_ROLES.map(role => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
                <SelectItem value="custom">Annet...</SelectItem>
              </SelectContent>
            </Select>
            {newRole === 'custom' && (
              <Input
                placeholder="Skriv rollenavn"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Person</Label>
            <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
              <SelectTrigger>
                <SelectValue placeholder="Velg person" />
              </SelectTrigger>
              <SelectContent>
                {players.map(player => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          size="sm"
          onClick={addRole}
          disabled={!newRole || !selectedPlayer || newRole === 'custom'}
          variant="outline"
          className="w-full gap-2"
        >
          <Plus className="w-4 h-4" />
          Legg til rolle
        </Button>
      </div>
    </div>
  );
}