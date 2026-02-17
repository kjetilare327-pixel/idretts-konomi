import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, X, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/components/shared/FormatUtils';

export default function NotificationCenter({ userEmail, teamId }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userEmail, teamId],
    queryFn: () => base44.entities.Notification.filter({ 
      team_id: teamId,
      user_email: userEmail 
    }),
    enabled: !!userEmail && !!teamId,
    refetchInterval: 60000, // Refresh every minute
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notificationId) => {
    await base44.entities.Notification.update(notificationId, { read: true });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const notif of unread) {
      await base44.entities.Notification.update(notif.id, { read: true });
    }
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const deleteNotification = async (notificationId) => {
    await base44.entities.Notification.delete(notificationId);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50 dark:bg-red-950/30';
      case 'medium': return 'border-amber-500 bg-amber-50 dark:bg-amber-950/30';
      default: return 'border-slate-200 dark:border-slate-700';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'event_reminder': return '📅';
      case 'payment_due': return '💰';
      case 'profile_incomplete': return '👤';
      case 'volunteer_opportunity': return '🙌';
      case 'referral_update': return '🎁';
      case 'ai_suggestion': return '🤖';
      default: return '🔔';
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 p-0" align="end">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Varsler</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
              Merk alle som lest
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Ingen varsler</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 10).map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    !notif.read ? 'bg-indigo-50 dark:bg-indigo-950/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getTypeIcon(notif.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-medium text-sm">{notif.title}</h4>
                        {notif.priority === 'high' && (
                          <Badge className="bg-red-100 text-red-700 text-xs">Viktig</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {formatDate(notif.created_date)}
                        </span>
                        {notif.action_url && (
                          <a
                            href={notif.action_url}
                            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            onClick={() => setOpen(false)}
                          >
                            {notif.action_label || 'Vis mer'}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!notif.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => markAsRead(notif.id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteNotification(notif.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}