import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Users, DollarSign, Calendar } from 'lucide-react';

export default function RealtimeMetrics({ teamId }) {
  const [liveData, setLiveData] = useState({
    memberGrowth: [],
    paymentStatus: { paid: 0, partial: 0, unpaid: 0 },
    attendanceRate: []
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players-realtime', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId, status: 'active' }),
    enabled: !!teamId,
    refetchInterval: 30000, // Oppdater hvert 30. sekund
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims-realtime', teamId],
    queryFn: () => base44.entities.Claim.filter({ team_id: teamId }),
    enabled: !!teamId,
    refetchInterval: 30000,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events-realtime', teamId],
    queryFn: () => base44.entities.Event.filter({ team_id: teamId }),
    enabled: !!teamId,
    refetchInterval: 30000,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance-realtime', teamId],
    queryFn: () => base44.entities.EventAttendance.filter({ team_id: teamId }),
    enabled: !!teamId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (players.length === 0) return;

    // Medlemsvekst (siste 12 måneder)
    const monthlyGrowth = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const count = players.filter(p => {
        const created = new Date(p.created_date);
        return created <= monthEnd;
      }).length;

      monthlyGrowth.push({
        month: month.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' }),
        medlemmer: count
      });
    }

    // Betalingsstatus
    const paymentStatus = {
      paid: players.filter(p => p.payment_status === 'paid').length,
      partial: players.filter(p => p.payment_status === 'partial').length,
      unpaid: players.filter(p => p.payment_status === 'unpaid').length
    };

    // Oppmøte (siste 10 arrangementer)
    const recentEvents = events
      .filter(e => new Date(e.date) <= new Date())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    const attendanceRate = recentEvents.map(event => {
      const eventAttendance = attendance.filter(a => a.event_id === event.id);
      const present = eventAttendance.filter(a => a.attendance_status === 'present').length;
      const total = players.length;
      const rate = total > 0 ? (present / total * 100) : 0;

      return {
        event: event.title.substring(0, 15),
        prosent: Math.round(rate)
      };
    }).reverse();

    setLiveData({ memberGrowth: monthlyGrowth, paymentStatus, attendanceRate });
  }, [players, claims, events, attendance]);

  const trend = liveData.memberGrowth.length > 1 
    ? liveData.memberGrowth[liveData.memberGrowth.length - 1].medlemmer - liveData.memberGrowth[liveData.memberGrowth.length - 2].medlemmer
    : 0;

  const avgAttendance = liveData.attendanceRate.length > 0
    ? Math.round(liveData.attendanceRate.reduce((sum, d) => sum + d.prosent, 0) / liveData.attendanceRate.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Totalt medlemmer</p>
                <p className="text-3xl font-bold">{players.length}</p>
                <div className={`flex items-center gap-1 text-sm mt-1 ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{Math.abs(trend)} denne måneden</span>
                </div>
              </div>
              <Users className="w-10 h-10 text-indigo-400 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Betalingsstatus</p>
                <p className="text-3xl font-bold text-emerald-600">{liveData.paymentStatus.paid}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {liveData.paymentStatus.unpaid} ubetalte
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-emerald-400 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Gj.snitt oppmøte</p>
                <p className="text-3xl font-bold text-purple-600">{avgAttendance}%</p>
                <p className="text-xs text-slate-500 mt-1">
                  Siste {liveData.attendanceRate.length} arrangementer
                </p>
              </div>
              <Calendar className="w-10 h-10 text-purple-400 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base">Medlemsvekst (12 måneder)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={liveData.memberGrowth}>
                <defs>
                  <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="medlemmer" stroke="#6366f1" fillOpacity={1} fill="url(#colorMembers)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base">Oppmøte per arrangement</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={liveData.attendanceRate}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="event" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="prosent" fill="#a855f7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Payment status breakdown */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base">Betalingsstatus fordeling</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Betalt</span>
              <div className="flex items-center gap-3">
                <div className="w-48 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500"
                    style={{ width: `${players.length > 0 ? (liveData.paymentStatus.paid / players.length * 100) : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{liveData.paymentStatus.paid}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Delvis betalt</span>
              <div className="flex items-center gap-3">
                <div className="w-48 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500"
                    style={{ width: `${players.length > 0 ? (liveData.paymentStatus.partial / players.length * 100) : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{liveData.paymentStatus.partial}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Ubetalt</span>
              <div className="flex items-center gap-3">
                <div className="w-48 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500"
                    style={{ width: `${players.length > 0 ? (liveData.paymentStatus.unpaid / players.length * 100) : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{liveData.paymentStatus.unpaid}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}