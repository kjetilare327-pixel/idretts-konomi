import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDown, Mail, Loader2, Filter } from 'lucide-react';
import { formatNOK, formatDate } from '@/components/shared/FormatUtils';

export default function CustomReportBuilder({ teamId }) {
  const [config, setConfig] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    includeTransactions: true,
    includePlayers: true,
    includeBudget: true,
    includeClaims: true,
    includeEvents: false,
    includeVolunteer: false,
    transactionTypes: ['income', 'expense'],
    paymentStatus: ['paid', 'partial', 'unpaid'],
    format: 'csv'
  });

  const [generating, setGenerating] = useState(false);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', teamId],
    queryFn: () => base44.entities.Transaction.filter({ team_id: teamId }),
    enabled: !!teamId && config.includeTransactions,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
    enabled: !!teamId && config.includePlayers,
  });

  const { data: budget = [] } = useQuery({
    queryKey: ['budget', teamId],
    queryFn: () => base44.entities.Budget.filter({ team_id: teamId }),
    enabled: !!teamId && config.includeBudget,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims', teamId],
    queryFn: () => base44.entities.Claim.filter({ team_id: teamId }),
    enabled: !!teamId && config.includeClaims,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', teamId],
    queryFn: () => base44.entities.Event.filter({ team_id: teamId }),
    enabled: !!teamId && config.includeEvents,
  });

  const { data: volunteerTasks = [] } = useQuery({
    queryKey: ['volunteer-tasks', teamId],
    queryFn: () => base44.entities.VolunteerTask.filter({ team_id: teamId }),
    enabled: !!teamId && config.includeVolunteer,
  });

  const filterData = () => {
    const start = new Date(config.startDate);
    const end = new Date(config.endDate);

    const filtered = {
      transactions: config.includeTransactions 
        ? transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= start && tDate <= end && config.transactionTypes.includes(t.type);
          })
        : [],
      players: config.includePlayers 
        ? players.filter(p => config.paymentStatus.includes(p.payment_status))
        : [],
      budget: config.includeBudget ? budget : [],
      claims: config.includeClaims
        ? claims.filter(c => {
            const cDate = new Date(c.due_date);
            return cDate >= start && cDate <= end;
          })
        : [],
      events: config.includeEvents
        ? events.filter(e => {
            const eDate = new Date(e.date);
            return eDate >= start && eDate <= end;
          })
        : [],
      volunteerTasks: config.includeVolunteer
        ? volunteerTasks.filter(v => {
            const vDate = new Date(v.date);
            return vDate >= start && vDate <= end;
          })
        : []
    };

    return filtered;
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const data = filterData();
      
      if (config.format === 'csv') {
        let csv = '';
        
        // Transaksjoner
        if (data.transactions.length > 0) {
          csv += 'TRANSAKSJONER\n';
          csv += 'Dato,Type,Kategori,Beløp,Beskrivelse\n';
          data.transactions.forEach(t => {
            csv += `${formatDate(t.date)},${t.type === 'income' ? 'Inntekt' : 'Utgift'},${t.category},${t.amount},"${t.description || ''}"\n`;
          });
          csv += '\n';
        }

        // Spillere
        if (data.players.length > 0) {
          csv += 'SPILLERE\n';
          csv += 'Navn,E-post,Saldo,Betalingsstatus\n';
          data.players.forEach(p => {
            csv += `${p.full_name},${p.user_email},${p.balance || 0},${p.payment_status}\n`;
          });
          csv += '\n';
        }

        // Budsjett
        if (data.budget.length > 0) {
          csv += 'BUDSJETT\n';
          csv += 'Kategori,Type,Månedlig,Årlig\n';
          data.budget.forEach(b => {
            csv += `${b.category},${b.type === 'income' ? 'Inntekt' : 'Utgift'},${b.monthly_amount},${b.yearly_amount || b.monthly_amount * 12}\n`;
          });
          csv += '\n';
        }

        // Krav
        if (data.claims.length > 0) {
          csv += 'KRAV\n';
          csv += 'Type,Beløp,Forfallsdato,Status\n';
          data.claims.forEach(c => {
            csv += `${c.type},${c.amount},${formatDate(c.due_date)},${c.status}\n`;
          });
          csv += '\n';
        }

        // Events
        if (data.events.length > 0) {
          csv += 'ARRANGEMENTER\n';
          csv += 'Tittel,Type,Dato,Sted\n';
          data.events.forEach(e => {
            csv += `${e.title},${e.type},${formatDate(e.date)},${e.location || ''}\n`;
          });
          csv += '\n';
        }

        // Volunteer
        if (data.volunteerTasks.length > 0) {
          csv += 'DUGNAD\n';
          csv += 'Tittel,Kategori,Dato,Antall frivillige\n';
          data.volunteerTasks.forEach(v => {
            csv += `${v.title},${v.category},${formatDate(v.date)},${v.volunteers_needed}\n`;
          });
        }

        // Last ned
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rapport_${config.startDate}_${config.endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else if (config.format === 'text') {
        let text = `EGENDEFINERT RAPPORT\nPeriode: ${formatDate(config.startDate)} - ${formatDate(config.endDate)}\n\n`;
        
        if (data.transactions.length > 0) {
          const totalIncome = data.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
          const totalExpense = data.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          text += `TRANSAKSJONER\n`;
          text += `Totale inntekter: ${formatNOK(totalIncome)}\n`;
          text += `Totale utgifter: ${formatNOK(totalExpense)}\n`;
          text += `Netto: ${formatNOK(totalIncome - totalExpense)}\n\n`;
        }

        if (data.players.length > 0) {
          const totalBalance = data.players.reduce((s, p) => s + (p.balance || 0), 0);
          text += `SPILLERE\n`;
          text += `Antall spillere: ${data.players.length}\n`;
          text += `Total utestående: ${formatNOK(totalBalance)}\n\n`;
        }

        if (data.budget.length > 0) {
          const budgetIncome = data.budget.filter(b => b.type === 'income').reduce((s, b) => s + (b.yearly_amount || b.monthly_amount * 12), 0);
          const budgetExpense = data.budget.filter(b => b.type === 'expense').reduce((s, b) => s + (b.yearly_amount || b.monthly_amount * 12), 0);
          text += `BUDSJETT\n`;
          text += `Budsjetterte inntekter: ${formatNOK(budgetIncome)}\n`;
          text += `Budsjetterte utgifter: ${formatNOK(budgetExpense)}\n`;
          text += `Budsjettert overskudd: ${formatNOK(budgetIncome - budgetExpense)}\n\n`;
        }

        if (data.claims.length > 0) {
          const unpaidClaims = data.claims.filter(c => c.status !== 'paid').reduce((s, c) => s + c.amount, 0);
          text += `KRAV\n`;
          text += `Totale krav: ${data.claims.length}\n`;
          text += `Ubetalte krav: ${formatNOK(unpaidClaims)}\n\n`;
        }

        if (data.events.length > 0) {
          text += `ARRANGEMENTER\n`;
          text += `Antall arrangementer: ${data.events.length}\n\n`;
        }

        if (data.volunteerTasks.length > 0) {
          text += `DUGNAD\n`;
          text += `Antall dugnader: ${data.volunteerTasks.length}\n`;
        }

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rapport_${config.startDate}_${config.endDate}.txt`;
        link.click();
        URL.revokeObjectURL(url);
      }

      alert('Rapport generert og lastet ned!');
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Kunne ikke generere rapport');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle>Bygg din egendefinerte rapport</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fra dato</Label>
              <Input
                type="date"
                value={config.startDate}
                onChange={(e) => setConfig({...config, startDate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Til dato</Label>
              <Input
                type="date"
                value={config.endDate}
                onChange={(e) => setConfig({...config, endDate: e.target.value})}
              />
            </div>
          </div>

          {/* Data sources */}
          <div className="space-y-3">
            <Label className="text-base">Datakilder</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="transactions"
                  checked={config.includeTransactions}
                  onCheckedChange={(checked) => setConfig({...config, includeTransactions: checked})}
                />
                <label htmlFor="transactions" className="text-sm cursor-pointer">
                  Transaksjoner
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="players"
                  checked={config.includePlayers}
                  onCheckedChange={(checked) => setConfig({...config, includePlayers: checked})}
                />
                <label htmlFor="players" className="text-sm cursor-pointer">
                  Spillere
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="budget"
                  checked={config.includeBudget}
                  onCheckedChange={(checked) => setConfig({...config, includeBudget: checked})}
                />
                <label htmlFor="budget" className="text-sm cursor-pointer">
                  Budsjett
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="claims"
                  checked={config.includeClaims}
                  onCheckedChange={(checked) => setConfig({...config, includeClaims: checked})}
                />
                <label htmlFor="claims" className="text-sm cursor-pointer">
                  Krav
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="events"
                  checked={config.includeEvents}
                  onCheckedChange={(checked) => setConfig({...config, includeEvents: checked})}
                />
                <label htmlFor="events" className="text-sm cursor-pointer">
                  Arrangementer
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="volunteer"
                  checked={config.includeVolunteer}
                  onCheckedChange={(checked) => setConfig({...config, includeVolunteer: checked})}
                />
                <label htmlFor="volunteer" className="text-sm cursor-pointer">
                  Dugnad
                </label>
              </div>
            </div>
          </div>

          {/* Filters */}
          {config.includeTransactions && (
            <div className="space-y-2">
              <Label>Transaksjonstyper</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="income"
                    checked={config.transactionTypes.includes('income')}
                    onCheckedChange={(checked) => {
                      const types = checked 
                        ? [...config.transactionTypes, 'income']
                        : config.transactionTypes.filter(t => t !== 'income');
                      setConfig({...config, transactionTypes: types});
                    }}
                  />
                  <label htmlFor="income" className="text-sm cursor-pointer">Inntekt</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="expense"
                    checked={config.transactionTypes.includes('expense')}
                    onCheckedChange={(checked) => {
                      const types = checked 
                        ? [...config.transactionTypes, 'expense']
                        : config.transactionTypes.filter(t => t !== 'expense');
                      setConfig({...config, transactionTypes: types});
                    }}
                  />
                  <label htmlFor="expense" className="text-sm cursor-pointer">Utgift</label>
                </div>
              </div>
            </div>
          )}

          {/* Format */}
          <div className="space-y-2">
            <Label>Eksportformat</Label>
            <Select value={config.format} onValueChange={(v) => setConfig({...config, format: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Excel)</SelectItem>
                <SelectItem value="text">Tekstfil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={generateReport}
              disabled={generating}
              className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Genererer...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Generer og last ned
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle>Forhåndsvisning</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Periode:</strong> {formatDate(config.startDate)} - {formatDate(config.endDate)}</p>
            <p><strong>Datakilder:</strong> {
              [
                config.includeTransactions && 'Transaksjoner',
                config.includePlayers && 'Spillere',
                config.includeBudget && 'Budsjett',
                config.includeClaims && 'Krav',
                config.includeEvents && 'Arrangementer',
                config.includeVolunteer && 'Dugnad'
              ].filter(Boolean).join(', ')
            }</p>
            <p><strong>Format:</strong> {config.format === 'csv' ? 'CSV (Excel)' : 'Tekstfil'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}