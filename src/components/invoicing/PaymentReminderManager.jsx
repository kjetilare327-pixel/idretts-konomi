import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bell, Loader2, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { formatNOK, formatDate } from '@/components/shared/FormatUtils';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PaymentReminderManager({ teamId }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: overdueClaims = [], isLoading } = useQuery({
    queryKey: ['overdue-claims', teamId],
    queryFn: async () => {
      const claims = await base44.entities.Claim.filter({ team_id: teamId });
      const now = new Date();
      
      return claims.filter(c => {
        if (c.status !== 'pending' && c.status !== 'overdue') return false;
        const dueDate = new Date(c.due_date);
        return dueDate < now;
      }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    },
    enabled: !!teamId
  });

  const sendReminders = async () => {
    setSending(true);
    setResult(null);

    try {
      const response = await base44.functions.invoke('sendPaymentReminders', {});
      setResult(response.data);
      
      // Oppdater query cache
      queryClient.invalidateQueries({ queryKey: ['overdue-claims', teamId] });
      queryClient.invalidateQueries({ queryKey: ['claims', teamId] });
      
    } catch (error) {
      console.error('Failed to send reminders:', error);
      setResult({ error: 'Kunne ikke sende purringer. Prøv igjen.' });
    } finally {
      setSending(false);
    }
  };

  const getDaysOverdue = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    return Math.floor((now - due) / (1000 * 60 * 60 * 24));
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Automatisk purring</CardTitle>
              <CardDescription>
                Send betalingspåminnelser for forfalte fakturaer
              </CardDescription>
            </div>
          </div>
          <Button 
            onClick={sendReminders} 
            disabled={sending || overdueClaims.length === 0}
            className="bg-amber-600 hover:bg-amber-700 gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sender...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send purringer
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {result && (
          <Alert className={result.error ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}>
            {result.error ? (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
            <AlertDescription className={result.error ? "text-red-800" : "text-emerald-800"}>
              {result.error || `${result.remindersSent} purringer sendt for ${result.overdueClaims} forfalte fakturaer`}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-1">Forfalte fakturaer</p>
            <p className="text-2xl font-bold text-amber-600">{overdueClaims.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
            <p className="text-xs text-red-700 dark:text-red-400 mb-1">Totalt utestående</p>
            <p className="text-2xl font-bold text-red-600">
              {formatNOK(overdueClaims.reduce((sum, c) => sum + c.amount, 0))}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Automatisk purring</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                Aktiv
              </Badge>
              <span className="text-xs text-slate-500">Hver 7. dag</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : overdueClaims.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400">Ingen forfalte fakturaer</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead>Medlem</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Beløp</TableHead>
                  <TableHead>Forfall</TableHead>
                  <TableHead>Dager forfalt</TableHead>
                  <TableHead>Sist purret</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueClaims.map(claim => {
                  const daysOverdue = getDaysOverdue(claim.due_date);
                  const lastReminder = claim.last_reminder_sent 
                    ? formatDate(claim.last_reminder_sent)
                    : 'Aldri';

                  return (
                    <TableRow key={claim.id}>
                      <TableCell className="font-medium">
                        {claim.player_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{claim.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatNOK(claim.amount)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(claim.due_date)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            daysOverdue > 30 
                              ? "border-red-600 text-red-600" 
                              : daysOverdue > 14 
                              ? "border-amber-600 text-amber-600"
                              : "border-slate-600 text-slate-600"
                          }
                        >
                          {daysOverdue} dager
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {lastReminder}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Slik fungerer automatisk purring:
          </p>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <li>• Purringer sendes automatisk 7 dager etter forfall</li>
            <li>• Nye purringer sendes hver 7. dag til faktura er betalt</li>
            <li>• E-post inkluderer Vipps-betalingslenke for enkel betaling</li>
            <li>• Alle purringer logges og er sporbare</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}