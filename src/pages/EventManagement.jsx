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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Plus, MapPin, Clock, Users, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

export default function EventManagement() {
  const { currentTeam, isTeamAdmin, playerProfile } = useTeam();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', type: 'training', date: '', start_time: '', end_time: '',
    location: '', opponent: '', max_participants: 0
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', currentTeam?.id],
    queryFn: () => base44.entities.Event.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['event-attendance', currentTeam?.id],
    queryFn: () => base44.entities.EventAttendance.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', currentTeam?.id],
    queryFn: () => base44.entities.Player.filter({ team_id: currentTeam.id, status: 'active' }),
    enabled: !!currentTeam,
  });

  const handleCreate = async () => {
    if (!form.title || !form.date || !form.start_time) return;
    
    await base44.entities.Event.create({
      ...form,
      team_id: currentTeam.id,
      status: 'scheduled',
      max_participants: form.max_participants || null
    });
    
    setShowForm(false);
    setForm({ title: '', description: '', type: 'training', date: '', start_time: '', end_time: '', location: '', opponent: '', max_participants: 0 });
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const handleRSVP = async (eventId, status) => {
    if (!playerProfile) {
      alert('Du må være registrert som spiller for å melde deg på');
      return;
    }

    const existing = attendance.find(a => a.event_id === eventId && a.player_id === playerProfile.id);
    
    if (existing) {
      await base44.entities.EventAttendance.update(existing.id, {
        rsvp_status: status,
        rsvp_at: new Date().toISOString()
      });
    } else {
      await base44.entities.EventAttendance.create({
        team_id: currentTeam.id,
        event_id: eventId,
        player_id: playerProfile.id,
        rsvp_status: status,
        rsvp_at: new Date().toISOString()
      });
    }

    queryClient.invalidateQueries({ queryKey: ['event-attendance'] });
  };

  const handleCheckIn = async (eventId, playerId) => {
    const existing = attendance.find(a => a.event_id === eventId && a.player_id === playerId);
    
    if (existing) {
      await base44.entities.EventAttendance.update(existing.id, {
        attendance_status: 'present',
        checked_in_at: new Date().toISOString()
      });
    } else {
      await base44.entities.EventAttendance.create({
        team_id: currentTeam.id,
        event_id: eventId,
        player_id: playerId,
        rsvp_status: 'yes',
        attendance_status: 'present',
        checked_in_at: new Date().toISOString()
      });
    }

    queryClient.invalidateQueries({ queryKey: ['event-attendance'] });
  };

  const getEventStats = (eventId) => {
    const eventAttendance = attendance.filter(a => a.event_id === eventId);
    return {
      yes: eventAttendance.filter(a => a.rsvp_status === 'yes').length,
      no: eventAttendance.filter(a => a.rsvp_status === 'no').length,
      maybe: eventAttendance.filter(a => a.rsvp_status === 'maybe').length,
      pending: players.length - eventAttendance.length,
      present: eventAttendance.filter(a => a.attendance_status === 'present').length
    };
  };

  const getPlayerRSVP = (eventId) => {
    if (!playerProfile) return null;
    return attendance.find(a => a.event_id === eventId && a.player_id === playerProfile.id);
  };

  const isAdmin = isTeamAdmin();

  if (!currentTeam) return <div className="p-6">Laster...</div>;

  const upcomingEvents = events
    .filter(e => new Date(e.date) >= new Date() && e.status === 'scheduled')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const pastEvents = events
    .filter(e => new Date(e.date) < new Date() || e.status === 'completed')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Arrangementer & Oppmøte</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {isAdmin ? 'Administrer arrangementer og registrer oppmøte' : 'Se arrangementer og meld deg på'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" />
            Opprett arrangement
          </Button>
        )}
      </div>

      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming">Kommende ({upcomingEvents.length})</TabsTrigger>
          <TabsTrigger value="past">Tidligere</TabsTrigger>
          {isAdmin && <TabsTrigger value="reports">Rapporter</TabsTrigger>}
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map(event => {
              const stats = getEventStats(event.id);
              const playerRSVP = getPlayerRSVP(event.id);

              return (
                <Card key={event.id} className="border-0 shadow-md dark:bg-slate-900">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-xl">{event.title}</h3>
                          <Badge variant="outline">
                            {event.type === 'training' ? 'Trening' :
                             event.type === 'match' ? 'Kamp' :
                             event.type === 'meeting' ? 'Møte' :
                             event.type === 'social' ? 'Sosialt' :
                             event.type === 'tournament' ? 'Turnering' : 'Annet'}
                          </Badge>
                        </div>
                        {event.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{event.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm mb-4">
                          <div className="flex items-center gap-1 text-slate-500">
                            <Calendar className="w-4 h-4" />
                            {new Date(event.date).toLocaleDateString('nb-NO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-4 h-4" />
                            {event.start_time} {event.end_time && `- ${event.end_time}`}
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <MapPin className="w-4 h-4" />
                              {event.location}
                            </div>
                          )}
                          {event.opponent && (
                            <div className="text-slate-500">
                              vs. {event.opponent}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="font-medium text-emerald-600">{stats.yes} kommer</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="font-medium text-red-600">{stats.no} kommer ikke</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <HelpCircle className="w-4 h-4 text-amber-500" />
                            <span className="font-medium text-amber-600">{stats.maybe} kanskje</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500">{stats.pending} ikke svart</span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col gap-2">
                        {!isAdmin && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleRSVP(event.id, 'yes')}
                              variant={playerRSVP?.rsvp_status === 'yes' ? 'default' : 'outline'}
                              className="gap-2"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Kommer
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleRSVP(event.id, 'no')}
                              variant={playerRSVP?.rsvp_status === 'no' ? 'default' : 'outline'}
                              className="gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              Kommer ikke
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleRSVP(event.id, 'maybe')}
                              variant={playerRSVP?.rsvp_status === 'maybe' ? 'default' : 'outline'}
                              className="gap-2"
                            >
                              <HelpCircle className="w-4 h-4" />
                              Kanskje
                            </Button>
                          </>
                        )}
                        {isAdmin && (
                          <Button
                            size="sm"
                            onClick={() => setSelectedEvent(event)}
                            className="gap-2"
                          >
                            <Users className="w-4 h-4" />
                            Registrer oppmøte
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <p className="text-center py-12 text-slate-500">Ingen kommende arrangementer</p>
          )}
        </TabsContent>

        <TabsContent value="past">
          {pastEvents.length > 0 ? (
            <div className="space-y-3">
              {pastEvents.slice(0, 10).map(event => {
                const stats = getEventStats(event.id);
                return (
                  <Card key={event.id} className="border-0 shadow-sm dark:bg-slate-900">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{event.title}</h3>
                          <p className="text-xs text-slate-500">
                            {new Date(event.date).toLocaleDateString('nb-NO')} • {stats.present} møtte opp
                          </p>
                        </div>
                        {isAdmin && (
                          <Button size="sm" variant="outline" onClick={() => setSelectedEvent(event)}>
                            Se detaljer
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-12 text-slate-500">Ingen tidligere arrangementer</p>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="reports">
            <Card className="border-0 shadow-md dark:bg-slate-900">
              <CardHeader>
                <CardTitle>Oppmøterapport</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {players.map(player => {
                    const playerAttendance = attendance.filter(a => a.player_id === player.id);
                    const totalEvents = events.filter(e => e.status === 'completed' || new Date(e.date) < new Date()).length;
                    const attended = playerAttendance.filter(a => a.attendance_status === 'present').length;
                    const percentage = totalEvents > 0 ? (attended / totalEvents * 100).toFixed(0) : 0;

                    return (
                      <div key={player.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <h3 className="font-medium">{player.full_name}</h3>
                          <p className="text-xs text-slate-500">{attended}/{totalEvents} arrangementer</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${
                            percentage >= 80 ? 'text-emerald-600' :
                            percentage >= 60 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {percentage}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Attendance dialog */}
      {selectedEvent && isAdmin && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Oppmøteregistrering - {selectedEvent.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {players.map(player => {
                const playerAttendance = attendance.find(a => a.event_id === selectedEvent.id && a.player_id === player.id);
                const isPresent = playerAttendance?.attendance_status === 'present';

                return (
                  <div key={player.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <h3 className="font-medium">{player.full_name}</h3>
                      {playerAttendance?.rsvp_status && (
                        <p className="text-xs text-slate-500">
                          RSVP: {playerAttendance.rsvp_status === 'yes' ? 'Kommer' :
                                 playerAttendance.rsvp_status === 'no' ? 'Kommer ikke' : 'Kanskje'}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCheckIn(selectedEvent.id, player.id)}
                      variant={isPresent ? 'default' : 'outline'}
                      className="gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isPresent ? 'Til stede' : 'Registrer'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create event dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Opprett nytt arrangement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Tittel</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
                placeholder="F.eks. Trening, Hjemmekamp"
              />
            </div>
            <div className="space-y-2">
              <Label>Beskrivelse</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({...form, description: e.target.value})}
                placeholder="Detaljer om arrangementet"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="training">Trening</SelectItem>
                    <SelectItem value="match">Kamp</SelectItem>
                    <SelectItem value="tournament">Turnering</SelectItem>
                    <SelectItem value="meeting">Møte</SelectItem>
                    <SelectItem value="social">Sosialt</SelectItem>
                    <SelectItem value="other">Annet</SelectItem>
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
                placeholder="F.eks. Idrettshallen"
              />
            </div>
            {form.type === 'match' && (
              <div className="space-y-2">
                <Label>Motstander</Label>
                <Input
                  value={form.opponent}
                  onChange={(e) => setForm({...form, opponent: e.target.value})}
                  placeholder="Navn på motstanderlag"
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                Avbryt
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!form.title || !form.date || !form.start_time}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                Opprett arrangement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}