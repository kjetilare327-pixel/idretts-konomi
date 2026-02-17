import React, { useState } from 'react';
import { useTeam } from '@/components/shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Send } from 'lucide-react';

const MESSAGE_TYPES = [
  {
    id: 'payment_reminders',
    label: 'Betalingspurringer',
    description: 'Send purringer til medlemmer med ubetalte krav',
    icon: '💰'
  },
  {
    id: 'anniversaries',
    label: 'Jubileumsgratulasjoner',
    description: 'Gratulér medlemmer på medlemskaps-jubileum',
    icon: '🎉'
  },
  {
    id: 'event_invitations',
    label: 'Arrangementsinnkallinger',
    description: 'Påminne medlemmer om kommende arrangementer',
    icon: '📅'
  },
  {
    id: 'congratulations',
    label: 'Takk for betaling',
    description: 'Takk til medlemmer som betaler regelmessig',
    icon: '✅'
  }
];

export default function StatusMessageManager() {
  const { currentTeam, isTeamAdmin } = useTeam();
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState(null);

  if (!isTeamAdmin()) return null;

  const handleSendMessages = async (messageType) => {
    setLoading(true);
    setSentMessage(null);

    try {
      const response = await base44.functions.invoke('sendMemberStatusMessages', {
        team_id: currentTeam.id,
        message_type: messageType
      });

      setSentMessage({
        success: true,
        count: response.data.count,
        message: response.data.message
      });
    } catch (error) {
      setSentMessage({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Statusbaserte meldinger
          </CardTitle>
          <CardDescription>
            Send automatiserte meldinger basert på medlemmerenes status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sentMessage && (
            <div className={`p-3 rounded-lg border ${
              sentMessage.success
                ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
            }`}>
              <p className={sentMessage.success ? 'text-emerald-700 dark:text-emerald-200' : 'text-red-700 dark:text-red-200'}>
                {sentMessage.success ? `✓ ${sentMessage.message}` : `✗ ${sentMessage.error}`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MESSAGE_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => handleSendMessages(type.id)}
                disabled={loading}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{type.icon}</span>
                      <h3 className="font-semibold text-sm">{type.label}</h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {type.description}
                    </p>
                  </div>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <Send className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}