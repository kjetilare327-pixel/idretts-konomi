import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function EngagementTrendWidget({ teamId }) {
  const navigate = useNavigate();

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

  const { data: players = [] } = useQuery({
    queryKey: ['players', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
    enabled: !!teamId
  });

  const engagementData = useMemo(() => {
    const monthlyEngagement = {};
    
    attendance.forEach(att => {
      const date = new Date(att.rsvp_at || att.checked_in_at || new Date());
      const month = date.toLocaleString('nb-NO', { month: 'short' });
      
      if (!monthlyEngagement[month]) {
        monthlyEngagement[month] = { month, present: 0, total: 0 };
      }
      
      monthlyEngagement[month].total += 1;
      if (att.attendance_status === 'present') {
        monthlyEngagement[month].present += 1;
      }
    });

    return Object.values(monthlyEngagement)
      .map(m => ({ ...m, rate: m.total > 0 ? (m.present / m.total) * 100 : 0 }))
      .slice(-6);
  }, [attendance]);

  const currentEngagement = useMemo(() => {
    if (players.length === 0) return 0;
    const activeEngaged = players.filter(p => p.status === 'active' && p.payment_status !== 'unpaid').length;
    return Math.round((activeEngaged / players.length) * 100);
  }, [players]);

  return (
    <Card 
      className="border-0 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
      onClick={() => navigate(createPageUrl('MemberManagement'))}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Medlemsengasjement
          </CardTitle>
          <span className="text-2xl font-bold text-blue-600">{currentEngagement}%</span>
        </div>
      </CardHeader>
      <CardContent>
        {engagementData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
              <XAxis dataKey="month" style={{ fontSize: '12px' }} />
              <YAxis style={{ fontSize: '12px' }} />
              <Tooltip formatter={(value) => `${Math.round(value)}%`} />
              <Line 
                type="monotone" 
                dataKey="rate" 
                stroke="#2563eb" 
                strokeWidth={2}
                dot={{ fill: '#2563eb', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-slate-500">
            Ingen data ennå
          </div>
        )}
      </CardContent>
    </Card>
  );
}