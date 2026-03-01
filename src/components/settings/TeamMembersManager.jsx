import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useTeam } from '@/components/shared/TeamContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = [
  { value: 'admin', label: 'Admin', color: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300' },
  { value: 'kasserer', label: 'Kasserer', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' },
  { value: 'styreleder', label: 'Styreleder', color: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300' },
  { value: 'revisor', label: 'Revisor', color: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300' },
  { value: 'forelder', label: 'Forelder', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300' },
  { value: 'player', label: 'Spiller', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
];

const roleInfo = Object.fromEntries(ROLES.map(r => [r.value, r]));

export default function TeamMembersManager() {
  const { currentTeam, user, currentTeamRole, refreshTeamMembers } = useTeam();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('kasserer');
  const [inviting, setInviting] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['teamMembers', currentTeam?.id],
    queryFn: () => base44.entities.TeamMember.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam?.id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['teamMembers', currentTeam?.id] });
    if (refreshTeamMembers) refreshTeamMembers();
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !currentTeam) return;
    if (members.find(m => m.user_email === email)) {
      toast.error('Denne e-posten er allerede lagt til.');
      return;
    }
    setInviting(true);
    try {
      await base44.entities.TeamMember.create({
        team_id: currentTeam.id,
        user_email: email,
        role: inviteRole,
        status: 'invited',
        invited_by_email: user?.email,
      });
      // Send invitation email
      await base44.functions.invoke('sendTeamInvitation', {
        team_id: currentTeam.id,
        recipient_email: email,
        role: inviteRole,
        team_name: currentTeam.name,
      }).catch(err => {
        console.warn('Email send failed, but invitation created:', err.message);
      });
      toast.success(`${email} lagt til som ${roleInfo[inviteRole]?.label}`);
      setInviteEmail('');
      invalidate();
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (memberId, newRole) => {
    await base44.entities.TeamMember.update(memberId, { role: newRole });
    invalidate();
    toast.success('Rolle oppdatert');
  };

  const handleActivate = async (memberId) => {
    await base44.entities.TeamMember.update(memberId, { status: 'active' });
    invalidate();
    toast.success('Aktivert');
  };

  const handleRemove = async (memberId, email) => {
    if (email === user?.email) {
      toast.error('Du kan ikke fjerne deg selv.');
      return;
    }
    await base44.entities.TeamMember.delete(memberId);
    invalidate();
    toast.success('Medlem fjernet');
  };

  const isAdmin = currentTeamRole === 'admin';

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-500" /> Medlemmer / Tilganger
        </CardTitle>
        <CardDescription>Administrer tilgang til laget med roller</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="E-postadresse"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              className="flex-1 min-w-48"
            />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail} variant="outline" className="gap-1">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Inviter
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Ingen medlemmer registrert</p>
        ) : (
          <div className="space-y-2">
            {members.map(m => {
              const ri = roleInfo[m.role] || roleInfo['player'];
              const isMe = m.user_email === user?.email;
              return (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                      {m.user_email?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.user_email} {isMe && <span className="text-slate-400 text-xs">(deg)</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ri.color}`}>{ri.label}</span>
                        {m.status === 'invited' && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">● Invitert</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isAdmin && !isMe && (
                    <div className="flex items-center gap-1 shrink-0">
                      {m.status === 'invited' && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => handleActivate(m.id)}>
                          Aktiver
                        </Button>
                      )}
                      <Select value={m.role} onValueChange={v => handleChangeRole(m.id, v)}>
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleRemove(m.id, m.user_email)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400 font-semibold mb-2">Rolleoversikt</p>
          <div className="grid grid-cols-2 gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span><strong>Admin</strong>: full tilgang</span>
            <span><strong>Kasserer</strong>: økonomi + faktura</span>
            <span><strong>Styreleder</strong>: les + godkjenn</span>
            <span><strong>Revisor</strong>: les + eksport</span>
            <span><strong>Forelder/Spiller</strong>: kun egne betalinger</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}