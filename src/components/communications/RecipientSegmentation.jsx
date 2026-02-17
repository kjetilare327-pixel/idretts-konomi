import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, DollarSign, Calendar, UserCheck } from 'lucide-react';

export default function RecipientSegmentation({ players, selectedRecipients, onRecipientsChange }) {
  const segments = useMemo(() => {
    return {
      all: {
        label: 'Alle medlemmer',
        icon: Users,
        count: players.length,
        recipients: players
      },
      players: {
        label: 'Kun spillere',
        icon: UserCheck,
        count: players.filter(p => p.role === 'player').length,
        recipients: players.filter(p => p.role === 'player')
      },
      parents: {
        label: 'Kun foreldre',
        icon: Users,
        count: players.filter(p => p.role === 'parent').length,
        recipients: players.filter(p => p.role === 'parent')
      },
      paid: {
        label: 'Betalt status',
        icon: DollarSign,
        count: players.filter(p => p.payment_status === 'paid').length,
        recipients: players.filter(p => p.payment_status === 'paid')
      },
      partial: {
        label: 'Delvis betalt',
        icon: DollarSign,
        count: players.filter(p => p.payment_status === 'partial').length,
        recipients: players.filter(p => p.payment_status === 'partial')
      },
      unpaid: {
        label: 'Ubetalt status',
        icon: DollarSign,
        count: players.filter(p => p.payment_status === 'unpaid').length,
        recipients: players.filter(p => p.payment_status === 'unpaid')
      },
      newMembers: {
        label: 'Nye medlemmer (30 dager)',
        icon: Calendar,
        count: players.filter(p => {
          const created = new Date(p.created_date);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return created > thirtyDaysAgo;
        }).length,
        recipients: players.filter(p => {
          const created = new Date(p.created_date);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return created > thirtyDaysAgo;
        })
      }
    };
  }, [players]);

  const handleSegmentSelect = (segmentKey) => {
    const segment = segments[segmentKey];
    onRecipientsChange(segment.recipients.map(p => p.user_email));
  };

  const toggleRecipient = (email) => {
    const isSelected = selectedRecipients.includes(email);
    if (isSelected) {
      onRecipientsChange(selectedRecipients.filter(e => e !== email));
    } else {
      onRecipientsChange([...selectedRecipients, email]);
    }
  };

  return (
    <Card className="border-0 shadow-md dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-base">Segmenter mottakere</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick segments */}
        <div className="space-y-2">
          <Label className="text-sm">Hurtigvalg</Label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(segments).map(([key, segment]) => {
              const Icon = segment.icon;
              return (
                <button
                  key={key}
                  onClick={() => handleSegmentSelect(key)}
                  className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium">{segment.label}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{segment.count} personer</Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Individual selection */}
        <div className="space-y-2">
          <Label className="text-sm">Eller velg enkeltpersoner</Label>
          <div className="max-h-64 overflow-y-auto space-y-2 p-2 rounded-lg border bg-slate-50 dark:bg-slate-800">
            {players.map(player => {
              const isSelected = selectedRecipients.includes(player.user_email);
              return (
                <div key={player.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`player-${player.id}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleRecipient(player.user_email)}
                  />
                  <label
                    htmlFor={`player-${player.id}`}
                    className="flex-1 text-sm cursor-pointer flex items-center justify-between"
                  >
                    <span>{player.full_name}</span>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs">
                        {player.role === 'player' ? 'Spiller' : 'Forelder'}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${
                        player.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                        player.payment_status === 'partial' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {player.payment_status === 'paid' ? 'Betalt' :
                         player.payment_status === 'partial' ? 'Delvis' : 'Ubetalt'}
                      </Badge>
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">Valgte mottakere:</span>
            <Badge className="bg-indigo-100 text-indigo-700 text-sm">
              {selectedRecipients.length} personer
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}