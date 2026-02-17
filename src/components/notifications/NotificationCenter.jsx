import React, { useState } from 'react';
import { useTeam } from '@/components/shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Bell, Send, Loader2 } from 'lucide-react';

export default function NotificationCenter() {
  const { currentTeam, isTeamAdmin } = useTeam();
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'info',
    segmentIds: []
  });
  const queryClient = useQueryClient();

  const { data: segments = [] } = useQuery({
    queryKey: ['memberSegments', currentTeam?.id],
    queryFn: () => base44.entities.MemberSegment.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam
  });

  const handleSendNotification = async () => {
    if (!form.title || !form.message || form.segmentIds.length === 0) return;

    setLoading(true);
    try {
      const response = await base44.functions.invoke('sendMassNotifications', {
        team_id: currentTeam.id,
        title: form.title,
        message: form.message,
        notification_type: form.type,
        segment_ids: form.segmentIds
      });

      if (response.data.success) {
        setForm({ title: '', message: '', type: 'info', segmentIds: [] });
        setShowDialog(false);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSegment = (segmentId) => {
    setForm(prev => ({
      ...prev,
      segmentIds: prev.segmentIds.includes(segmentId)
        ? prev.segmentIds.filter(id => id !== segmentId)
        : [...prev.segmentIds, segmentId]
    }));
  };

  if (!isTeamAdmin()) return null;

  return (
    <>
      <Button 
        onClick={() => setShowDialog(true)}
        className="gap-2 bg-blue-600 hover:bg-blue-700"
      >
        <Bell className="w-4 h-4" />
        Send varslinger
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Send massevarslinger
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Tittel</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
                placeholder="F.eks. 'Viktig: Oppdaterte betalingsbestemmelser'"
              />
            </div>

            <div className="space-y-2">
              <Label>Melding</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm({...form, message: e.target.value})}
                placeholder="Skriv meldingen her..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(value) => setForm({...form, type: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Informasjon</SelectItem>
                  <SelectItem value="warning">Advarsel</SelectItem>
                  <SelectItem value="success">Suksess</SelectItem>
                  <SelectItem value="error">Feil</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Send til segmenter</Label>
              <div className="space-y-2 p-3 border rounded-lg bg-slate-50 dark:bg-slate-900">
                {segments.length === 0 ? (
                  <p className="text-sm text-slate-500">Ingen segmenter opprettet</p>
                ) : (
                  segments.map(segment => (
                    <div key={segment.id} className="flex items-center gap-3">
                      <Checkbox
                        checked={form.segmentIds.includes(segment.id)}
                        onCheckedChange={() => toggleSegment(segment.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{segment.name}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {segment.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">
                Avbryt
              </Button>
              <Button
                onClick={handleSendNotification}
                disabled={loading || !form.title || !form.message || form.segmentIds.length === 0}
                className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sender...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send varsling
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}