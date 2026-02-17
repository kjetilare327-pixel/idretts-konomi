import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Send, Trash2 } from 'lucide-react';

export default function MemberSegmentation({ teamId, onSendMessage }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    criteria: {
      role: 'all',
      payment_status: [],
      balance_min: undefined,
      balance_max: undefined,
      has_overdue_claims: undefined
    }
  });
  const queryClient = useQueryClient();

  const { data: segments = [] } = useQuery({
    queryKey: ['member-segments', teamId],
    queryFn: () => base44.entities.MemberSegment.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId, status: 'active' }),
    enabled: !!teamId
  });

  const calculateMemberCount = (criteria) => {
    return players.filter(player => {
      if (criteria.role && criteria.role !== 'all' && player.role !== criteria.role) {
        return false;
      }
      if (criteria.payment_status?.length > 0 && 
          !criteria.payment_status.includes(player.payment_status)) {
        return false;
      }
      if (criteria.balance_min !== undefined && player.balance < criteria.balance_min) {
        return false;
      }
      if (criteria.balance_max !== undefined && player.balance > criteria.balance_max) {
        return false;
      }
      return true;
    }).length;
  };

  const handleCreate = async () => {
    const memberCount = calculateMemberCount(form.criteria);
    
    await base44.entities.MemberSegment.create({
      ...form,
      team_id: teamId,
      member_count: memberCount
    });
    
    setShowForm(false);
    setForm({
      name: '',
      description: '',
      criteria: {
        role: 'all',
        payment_status: [],
        balance_min: undefined,
        balance_max: undefined
      }
    });
    queryClient.invalidateQueries({ queryKey: ['member-segments'] });
  };

  const handleDelete = async (id) => {
    if (!confirm('Slett dette segmentet?')) return;
    await base44.entities.MemberSegment.delete(id);
    queryClient.invalidateQueries({ queryKey: ['member-segments'] });
  };

  const togglePaymentStatus = (status) => {
    const current = form.criteria.payment_status || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    setForm({
      ...form,
      criteria: { ...form.criteria, payment_status: updated }
    });
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Medlemssegmenter</CardTitle>
              <CardDescription>
                Segmenter medlemmer for målrettet kommunikasjon
              </CardDescription>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" />
            Nytt segment
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {segments.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            Ingen segmenter opprettet ennå
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {segments.map(segment => (
              <div key={segment.id} className="p-4 rounded-lg border bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{segment.name}</h3>
                    {segment.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {segment.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(segment.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-2xl font-bold px-3 py-1">
                      {segment.member_count}
                    </Badge>
                    <span className="text-sm text-slate-600">medlemmer</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {segment.criteria.role && segment.criteria.role !== 'all' && (
                      <Badge variant="outline">
                        {segment.criteria.role === 'player' ? 'Spillere' : 'Foreldre'}
                      </Badge>
                    )}
                    {segment.criteria.payment_status?.map(status => (
                      <Badge key={status} variant="outline">
                        {status === 'paid' ? 'Betalt' : status === 'partial' ? 'Delvis betalt' : 'Ikke betalt'}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <Button
                  size="sm"
                  onClick={() => onSendMessage?.(segment)}
                  className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
                >
                  <Send className="w-4 h-4" />
                  Send melding til segment
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Opprett nytt segment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Navn</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="F.eks. Medlemmer med ubetalte fakturaer"
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

            <div className="space-y-3">
              <Label>Kriterier</Label>
              
              <div className="space-y-2">
                <Label className="text-sm">Rolle</Label>
                <Select 
                  value={form.criteria.role} 
                  onValueChange={(v) => setForm({...form, criteria: {...form.criteria, role: v}})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="player">Kun spillere</SelectItem>
                    <SelectItem value="parent">Kun foreldre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Betalingsstatus</Label>
                <div className="flex flex-wrap gap-3">
                  {['paid', 'partial', 'unpaid'].map(status => (
                    <div key={status} className="flex items-center gap-2">
                      <Checkbox
                        checked={form.criteria.payment_status?.includes(status)}
                        onCheckedChange={() => togglePaymentStatus(status)}
                      />
                      <Label className="text-sm font-normal">
                        {status === 'paid' ? 'Betalt' : status === 'partial' ? 'Delvis' : 'Ubetalt'}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Min saldo (NOK)</Label>
                  <Input
                    type="number"
                    value={form.criteria.balance_min || ''}
                    onChange={(e) => setForm({
                      ...form,
                      criteria: {...form.criteria, balance_min: e.target.value ? parseFloat(e.target.value) : undefined}
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Maks saldo (NOK)</Label>
                  <Input
                    type="number"
                    value={form.criteria.balance_max || ''}
                    onChange={(e) => setForm({
                      ...form,
                      criteria: {...form.criteria, balance_max: e.target.value ? parseFloat(e.target.value) : undefined}
                    })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
              <p className="text-sm text-indigo-900 dark:text-indigo-200">
                <strong>{calculateMemberCount(form.criteria)}</strong> medlemmer matcher disse kriteriene
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                Avbryt
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!form.name}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                Opprett segment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}