import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, TrendingUp, Activity, Award } from 'lucide-react';

export default function MemberEngagementReport({ teamId }) {
  const { data: players = [] } = useQuery({
    queryKey: ['players', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', teamId],
    queryFn: () => base44.entities.Event.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', teamId],
    queryFn: () => base44.entities.EventAttendance.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['volunteer-tasks', teamId],
    queryFn: () => base44.entities.VolunteerTask.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['volunteer-assignments', teamId],
    queryFn: () => base44.entities.VolunteerAssignment.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const engagementMetrics = useMemo(() => {
    const metrics = players.map(player => {
      const playerAttendance = attendance.filter(a => a.player_id === player.id);
      const playerAssignments = assignments.filter(a => a.player_id === player.id);
      
      const totalEvents = events.filter(e => e.status !== 'cancelled').length;
      const attended = playerAttendance.filter(a => a.attendance_status === 'present').length;
      const attendanceRate = totalEvents > 0 ? (attended / totalEvents) * 100 : 0;
      
      const volunteered = playerAssignments.filter(a => a.status === 'completed').length;
      
      return {
        name: player.full_name,
        attendanceRate: Math.round(attendanceRate),
        volunteered,
        eventsAttended: attended,
        paymentStatus: player.payment_status,
        active: player.status === 'active'
      };
    });

    return metrics.sort((a, b) => b.attendanceRate - a.attendanceRate);
  }, [players, attendance, events, assignments]);

  const summaryStats = useMemo(() => {
    const avgAttendance = engagementMetrics.length > 0
      ? Math.round(engagementMetrics.reduce((sum, m) => sum + m.attendanceRate, 0) / engagementMetrics.length)
      : 0;
    
    const totalVolunteered = engagementMetrics.reduce((sum, m) => sum + m.volunteered, 0);
    const avgVolunteerHours = assignments.length > 0
      ? (assignments.reduce((sum, a) => sum + (a.hours_worked || 0), 0) / engagementMetrics.length).toFixed(1)
      : 0;

    return { avgAttendance, totalVolunteered, avgVolunteerHours };
  }, [engagementMetrics, assignments]);

  const engagementTrend = useMemo(() => {
    const monthlyData = {};
    
    attendance.forEach(a => {
      const month = new Date(a.created_date || a.rsvp_at).toISOString().slice(0, 7);
      if (!monthlyData[month]) monthlyData[month] = { month, present: 0, absent: 0, total: 0 };
      monthlyData[month].total++;
      if (a.attendance_status === 'present') monthlyData[month].present++;
      else monthlyData[month].absent++;
    });

    return Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(d => ({
        month: new Date(d.month + '-01').toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' }),
        oppmøte: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
        deltakere: d.present
      }));
  }, [attendance]);

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Gjennomsnittlig oppmøte</p>
                <p className="text-3xl font-bold text-emerald-600">{summaryStats.avgAttendance}%</p>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Totalt dugnadstimer</p>
                <p className="text-3xl font-bold text-blue-600">{summaryStats.avgVolunteerHours}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Aktive medlemmer</p>
                <p className="text-3xl font-bold text-purple-600">
                  {engagementMetrics.filter(m => m.active).length}/{engagementMetrics.length}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement trend */}
      {engagementTrend.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Oppmøte-trend siste 6 måneder</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={engagementTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="oppmøte" stroke="#10b981" name="Oppmøteprosent %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Member engagement details */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Medlems-engasjement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {engagementMetrics.map((member, i) => (
              <div key={i} className="p-4 rounded-lg border bg-white dark:bg-slate-900">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {member.eventsAttended} arrangementer • {member.volunteered} dugnader
                    </p>
                  </div>
                  <Badge variant={member.attendanceRate >= 80 ? 'default' : 'secondary'}>
                    {member.attendanceRate}% oppmøte
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className={
                    member.paymentStatus === 'paid' ? 'border-emerald-600 text-emerald-600' :
                    member.paymentStatus === 'partial' ? 'border-amber-600 text-amber-600' :
                    'border-red-600 text-red-600'
                  }>
                    {member.paymentStatus === 'paid' ? 'Betalt' : 
                     member.paymentStatus === 'partial' ? 'Delvis' : 'Ubetalt'}
                  </Badge>
                  {!member.active && (
                    <Badge variant="outline" className="border-slate-400 text-slate-600">
                      Inaktiv
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}