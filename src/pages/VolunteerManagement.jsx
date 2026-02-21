import React, { useState } from 'react';
import { useTeam } from '../components/shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Calendar, Clock, MapPin, CheckCircle2, UserPlus, DollarSign, TrendingUp } from 'lucide-react';
import PullToRefresh from '@/components/mobile/PullToRefresh';

export default function VolunteerManagement() {
  const { currentTeam, isTeamAdmin, playerProfile } = useTeam();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', category: 'arrangement', date: '',
    start_time: '', end_time: '', location: '', volunteers_needed: 1, hours_estimated: 2
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['volunteer-tasks', currentTeam?.id],
    queryFn: () => base44.entities.VolunteerTask.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['volunteer-assignments', currentTeam?.id],
    queryFn: () => base44.entities.VolunteerAssignment.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', currentTeam?.id],
    queryFn: () => base44.entities.Player.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', currentTeam?.id],
    queryFn: () => base44.entities.Event.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const handleCreate = async () => {
    if (!form.title || !form.date) return;
    
    await base44.entities.VolunteerTask.create({
      ...form,
      team_id: currentTeam.id,
      status: 'open'
    });
    
    setShowForm(false);
    setForm({ title: '', description: '', category: 'arrangement', date: '', start_time: '', end_time: '', location: '', volunteers_needed: 1, hours_estimated: 2 });
    queryClient.invalidateQueries({ queryKey: ['volunteer-tasks'] });
  };

  const handleSignUp = async (taskId) => {
    if (!playerProfile) {
      alert('Du må være registrert som spiller/forelder for å melde deg på');
      return;
    }

    const existing = assignments.find(a => a.task_id === taskId && a.player_id === playerProfile.id);
    if (existing) {
      alert('Du er allerede påmeldt denne dugnaden');
      return;
    }

    await base44.entities.VolunteerAssignment.create({
      team_id: currentTeam.id,
      task_id: taskId,
      player_id: playerProfile.id,
      status: 'signed_up'
    });

    queryClient.invalidateQueries({ queryKey: ['volunteer-assignments'] });
  };

  const handleComplete = async (taskId) => {
    await base44.entities.VolunteerTask.update(taskId, { status: 'completed' });
    
    // Marker alle assignments som completed
    const taskAssignments = assignments.filter(a => a.task_id === taskId);
    for (const assignment of taskAssignments) {
      await base44.entities.VolunteerAssignment.update(assignment.id, { status: 'completed' });
    }
    
    queryClient.invalidateQueries({ queryKey: ['volunteer-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['volunteer-assignments'] });
  };

  const handleMarkAttendance = async (taskId, playerId) => {
    const assignment = assignments.find(a => a.task_id === taskId && a.player_id === playerId);
    
    if (assignment) {
      await base44.entities.VolunteerAssignment.update(assignment.id, {
        status: 'completed',
        hours_worked: tasks.find(t => t.id === taskId)?.hours_estimated || 2
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ['volunteer-assignments'] });
  };

  const getTaskStats = (taskId) => {
    const taskAssignments = assignments.filter(a => a.task_id === taskId);
    return {
      signedUp: taskAssignments.filter(a => a.status === 'signed_up' || a.status === 'confirmed').length,
      completed: taskAssignments.filter(a => a.status === 'completed').length
    };
  };

  const isAdmin = isTeamAdmin();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['volunteer-tasks', currentTeam?.id] });
    await queryClient.invalidateQueries({ queryKey: ['volunteer-assignments', currentTeam?.id] });
  };

  if (!currentTeam) return <div className="p-6">Laster...</div>;

  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  // Økonomirelaterte arrangementer (kun turneringer og cuper som koster penger)
  const economicEvents = events.filter(e => 
    e.type === 'tournament' || e.type === 'social'
  ).sort((a, b) => new Date(a.date) - new Date(b.date));

  const upcomingEconomicEvents = economicEvents.filter(e => 
    new Date(e.date) >= new Date() && e.status === 'scheduled'
  );

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dugnad & Arrangementer (økonomi)</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {isAdmin ? 'Administrer dugnader og økonomirelaterte arrangementer' : 'Meld deg på dugnader og arrangementer'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(true)} className="gap-2 bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4" />
            Opprett dugnad
          </Button>
        )}
      </div>

      {/* Economic events (tournaments/cups with fees) */}
      {upcomingEconomicEvents.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900 border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" />
              Arrangementer med deltakeravgift
            </CardTitle>
            <CardDescription>Turneringer og cuper som krever betaling</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingEconomicEvents.map(event => (
                <div key={event.id} className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950/20">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{event.title}</h3>
                        <Badge className="bg-amber-100 text-amber-700">
                          {event.type === 'tournament' ? 'Turnering' : 'Sosialt'}
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(event.date).toLocaleDateString('nb-NO')}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <Button size="sm" variant="outline" className="gap-2">
                        <DollarSign className="w-4 h-4" />
                        Opprett krav
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Open tasks */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Aktive dugnader ({openTasks.length})
          </CardTitle>
          <CardDescription>Registrer oppmøte for dugnad for å spore inntekter og refusjoner</CardDescription>
        </CardHeader>
        <CardContent>
          {openTasks.length > 0 ? (
            <div className="space-y-4">
              {openTasks.map(task => {
                const stats = getTaskStats(task.id);
                const isFull = stats.signedUp >= task.volunteers_needed;
                const isSignedUp = playerProfile && assignments.some(a => a.task_id === task.id && a.player_id === playerProfile.id);
                const taskAssignments = assignments.filter(a => a.task_id === task.id);

                return (
                  <div key={task.id} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{task.title}</h3>
                          <Badge variant="outline">{task.category}</Badge>
                          {isFull && <Badge className="bg-emerald-100 text-emerald-700">Fulltegnet</Badge>}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{task.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1 text-slate-500">
                            <Calendar className="w-4 h-4" />
                            {new Date(task.date).toLocaleDateString('nb-NO')}
                          </div>
                          {task.start_time && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <Clock className="w-4 h-4" />
                              {task.start_time} {task.end_time && `- ${task.end_time}`}
                            </div>
                          )}
                          {task.location && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <MapPin className="w-4 h-4" />
                              {task.location}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-purple-500" />
                            <span className={stats.signedUp >= task.volunteers_needed ? 'text-emerald-600 font-medium' : ''}>
                              {stats.signedUp}/{task.volunteers_needed} påmeldte
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col gap-2">
                        {!isAdmin && (
                          <Button
                            size="sm"
                            onClick={() => handleSignUp(task.id)}
                            disabled={isSignedUp || isFull}
                            className="gap-2"
                          >
                            {isSignedUp ? (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                Påmeldt
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4" />
                                Meld meg på
                              </>
                            )}
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowForm(true)}
                            className="gap-2"
                          >
                            <Users className="w-4 h-4" />
                            Registrer oppmøte
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Attendance registration for admins */}
                    {isAdmin && task.status === 'in_progress' && taskAssignments.length > 0 && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <h4 className="text-sm font-medium mb-2">Hvem møtte opp?</h4>
                        {taskAssignments.map(assignment => {
                          const player = players.find(p => p.id === assignment.player_id);
                          const isCompleted = assignment.status === 'completed';
                          
                          return player ? (
                            <div key={assignment.id} className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900">
                              <span className="text-sm">{player.full_name}</span>
                              <Button
                                size="sm"
                                variant={isCompleted ? 'default' : 'outline'}
                                onClick={() => handleMarkAttendance(task.id, player.id)}
                                className="gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {isCompleted ? 'Møtt opp' : 'Registrer'}
                              </Button>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-slate-500">Ingen aktive dugnader</p>
          )}
        </CardContent>
      </Card>

      {/* Completed tasks with attendance tracking */}
      {isAdmin && completedTasks.length > 0 && (
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle>Fullførte dugnader ({completedTasks.length})</CardTitle>
            <CardDescription>Oppmøte registrert for økonomisk dokumentasjon</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedTasks.slice(0, 5).map(task => {
                const stats = getTaskStats(task.id);
                const taskAssignments = assignments.filter(a => a.task_id === task.id && a.status === 'completed');
                const totalHours = taskAssignments.reduce((sum, a) => sum + (a.hours_worked || 0), 0);
                
                return (
                  <div key={task.id} className="p-3 rounded-lg border bg-emerald-50 dark:bg-emerald-950/30">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium">{task.title}</h3>
                        <p className="text-xs text-slate-500">
                          {new Date(task.date).toLocaleDateString('nb-NO')} • {stats.completed} deltakere • {totalHours} timer totalt
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-100 text-purple-700">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Dugnadsinntekt
                        </Badge>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Opprett ny dugnad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Tittel</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
                placeholder="F.eks. Vårdugnading, Cupkiosk"
              />
            </div>
            <div className="space-y-2">
              <Label>Beskrivelse</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({...form, description: e.target.value})}
                placeholder="Hva skal gjøres?"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="arrangement">Arrangement</SelectItem>
                    <SelectItem value="vedlikehold">Vedlikehold</SelectItem>
                    <SelectItem value="kjøring">Kjøring</SelectItem>
                    <SelectItem value="administrativt">Administrativt</SelectItem>
                    <SelectItem value="annet">Annet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dato</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({...form, date: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Starttid</Label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({...form, start_time: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Sluttid</Label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({...form, end_time: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sted</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({...form, location: e.target.value})}
                placeholder="F.eks. Idrettshallen, Klubbhuset"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Antall frivillige trengs</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.volunteers_needed}
                  onChange={(e) => setForm({...form, volunteers_needed: parseInt(e.target.value) || 1})}
                />
              </div>
              <div className="space-y-2">
                <Label>Estimert timer</Label>
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={form.hours_estimated}
                  onChange={(e) => setForm({...form, hours_estimated: parseFloat(e.target.value) || 2})}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                Avbryt
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!form.title || !form.date}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                Opprett dugnad
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </PullToRefresh>
  );
}