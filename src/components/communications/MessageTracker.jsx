import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, CheckCircle2, Eye, XCircle, TrendingUp } from 'lucide-react';
import { formatDate } from '@/components/shared/FormatUtils';

export default function MessageTracker({ teamId }) {
  const { data: messages = [] } = useQuery({
    queryKey: ['sent-messages', teamId],
    queryFn: () => base44.entities.SentMessage.filter({ team_id: teamId }, '-sent_at', 50),
    enabled: !!teamId,
    refetchInterval: 10000, // Oppdater hvert 10. sekund
  });

  const stats = {
    total: messages.length,
    sent: messages.filter(m => m.status === 'sent').length,
    delivered: messages.filter(m => m.status === 'delivered').length,
    opened: messages.filter(m => m.status === 'opened').length,
    failed: messages.filter(m => m.status === 'failed').length,
    openRate: messages.length > 0 
      ? ((messages.filter(m => m.status === 'opened').length / messages.length) * 100).toFixed(1)
      : 0
  };

  const recentMessages = messages.slice(0, 20);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Totalt sendt</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Mail className="w-6 h-6 text-slate-400 opacity-30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Levert</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.delivered}</p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-emerald-400 opacity-30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Åpnet</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.opened}</p>
              </div>
              <Eye className="w-6 h-6 text-indigo-400 opacity-30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Feilet</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <XCircle className="w-6 h-6 text-red-400 opacity-30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Åpningsrate</p>
                <p className="text-2xl font-bold text-purple-600">{stats.openRate}%</p>
              </div>
              <TrendingUp className="w-6 h-6 text-purple-400 opacity-30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message list */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-base">Sendte meldinger</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">Alle ({stats.total})</TabsTrigger>
              <TabsTrigger value="opened">Åpnet ({stats.opened})</TabsTrigger>
              <TabsTrigger value="failed">Feilet ({stats.failed})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3">
              {recentMessages.map(msg => (
                <MessageItem key={msg.id} message={msg} />
              ))}
            </TabsContent>

            <TabsContent value="opened" className="space-y-3">
              {messages.filter(m => m.status === 'opened').slice(0, 20).map(msg => (
                <MessageItem key={msg.id} message={msg} />
              ))}
            </TabsContent>

            <TabsContent value="failed" className="space-y-3">
              {messages.filter(m => m.status === 'failed').slice(0, 20).map(msg => (
                <MessageItem key={msg.id} message={msg} />
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function MessageItem({ message }) {
  const statusConfig = {
    sent: { label: 'Sendt', color: 'bg-blue-100 text-blue-700', icon: Mail },
    delivered: { label: 'Levert', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    opened: { label: 'Åpnet', color: 'bg-indigo-100 text-indigo-700', icon: Eye },
    failed: { label: 'Feilet', color: 'bg-red-100 text-red-700', icon: XCircle }
  };

  const config = statusConfig[message.status] || statusConfig.sent;
  const Icon = config.icon;

  return (
    <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm">{message.subject}</h4>
            <Badge className={config.color}>
              <Icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Til: {message.recipient_name} ({message.recipient_email})
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>Sendt: {formatDate(message.sent_at)}</span>
        {message.opened_at && (
          <span>Åpnet: {formatDate(message.opened_at)}</span>
        )}
        {message.segment && (
          <Badge variant="outline" className="text-xs">{message.segment}</Badge>
        )}
      </div>
      {message.error_message && (
        <p className="text-xs text-red-600 mt-2">Feil: {message.error_message}</p>
      )}
    </div>
  );
}