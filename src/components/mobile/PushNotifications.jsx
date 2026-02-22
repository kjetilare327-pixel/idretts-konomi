import { useEffect, useState } from 'react';
import { useTeam } from '../shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, BellOff } from 'lucide-react';

const isNotificationSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

export default function PushNotifications() {
  const { currentTeam, user } = useTeam();
  const [permission, setPermission] = useState(() =>
    isNotificationSupported() ? window.Notification.permission : 'unsupported'
  );
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isNotificationSupported()) return;

    // Load saved preference
    const savedPref = localStorage.getItem('push_notifications_enabled');
    if (savedPref === 'true') {
      setEnabled(true);
    }
  }, []);

  const requestPermission = async () => {
    if (!isNotificationSupported()) return;
    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        setEnabled(true);
        localStorage.setItem('push_notifications_enabled', 'true');
        
        // Show test notification
        new window.Notification('Varsler aktivert! 🎉', {
          body: 'Du vil nå motta viktige varsler fra IdrettsØkonomi',
          icon: '/icon-192.png',
          badge: '/icon-192.png'
        });

        // In a real app, you would register with a push service here
        // For now, we'll use browser notifications
        startNotificationPolling();
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const disableNotifications = () => {
    setEnabled(false);
    localStorage.setItem('push_notifications_enabled', 'false');
  };

  // Poll for new notifications
  const startNotificationPolling = () => {
    if (!currentTeam || !user) return;

    // Check for new notifications every 30 seconds
    const interval = setInterval(async () => {
      try {
        const notifications = await base44.entities.Notification.filter({
          team_id: currentTeam.id,
          user_email: user.email,
          read: false
        });

        const recent = notifications.filter(n => {
          const created = new Date(n.created_date);
          const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
          return created > thirtySecondsAgo;
        });

        recent.forEach(notif => {
          if (Notification.permission === 'granted') {
            const notification = new Notification(notif.title, {
              body: notif.message,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: notif.id,
              requireInteraction: notif.priority === 'high'
            });

            notification.onclick = () => {
              // Mark as read
              base44.entities.Notification.update(notif.id, { read: true });
              if (notif.action_url) {
                window.location.href = notif.action_url;
              }
              notification.close();
            };
          }
        });
      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    }, 30 * 1000); // Every 30 seconds

    return () => clearInterval(interval);
  };

  useEffect(() => {
    if (enabled && permission === 'granted') {
      const cleanup = startNotificationPolling();
      return cleanup;
    }
  }, [enabled, permission, currentTeam, user]);

  if (!('Notification' in window)) {
    return null;
  }

  if (permission === 'denied') {
    return (
      <Card className="border-amber-200 dark:border-amber-900">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <BellOff className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium mb-1">Varsler er blokkert</p>
              <p className="text-slate-600 dark:text-slate-400">
                Aktiver varsler i nettleserinnstillingene for å motta viktige oppdateringer
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!enabled || permission !== 'granted') {
    return (
      <Card className="border-blue-200 dark:border-blue-900">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium mb-1 text-sm">Aktiver push-varsler</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                Få varsler om betalinger, arrangementer og dugnader
              </p>
              <Button size="sm" onClick={requestPermission} className="gap-2">
                <Bell className="w-4 h-4" />
                Aktiver varsler
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200 dark:border-emerald-900">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Varsler aktivert</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Du mottar nå viktige oppdateringer
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={disableNotifications}>
            <BellOff className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}