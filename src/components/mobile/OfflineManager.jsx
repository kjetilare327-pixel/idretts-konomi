import { useEffect, useState } from 'react';
import { useTeam } from '../shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi } from 'lucide-react';

// Simple offline data manager using localStorage
export default function OfflineManager() {
  const { currentTeam } = useTeam();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cache critical data when online
  useEffect(() => {
    if (!isOnline || !currentTeam) return;

    const cacheData = async () => {
      try {
        // Cache events
        const events = await base44.entities.Event.filter({ 
          team_id: currentTeam.id 
        });
        const upcomingEvents = events.filter(e => 
          new Date(e.date) >= new Date() && e.status === 'scheduled'
        ).slice(0, 20);
        localStorage.setItem('offline_events', JSON.stringify(upcomingEvents));

        // Cache players
        const players = await base44.entities.Player.filter({ 
          team_id: currentTeam.id,
          status: 'active'
        });
        localStorage.setItem('offline_players', JSON.stringify(players));

        // VolunteerTask entity not in this app — skip

        localStorage.setItem('offline_cache_time', new Date().toISOString());
      } catch (error) {
        console.error('Failed to cache offline data:', error);
      }
    };

    cacheData();
  }, [isOnline, currentTeam]);

  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      Frakoblet - viser lagret data
    </div>
  );
}

// Helper hook to get offline data
export function useOfflineData(key) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const cached = localStorage.getItem(`offline_${key}`);
    if (cached) {
      try {
        setData(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse offline data:', e);
      }
    }
  }, [key]);

  return data;
}