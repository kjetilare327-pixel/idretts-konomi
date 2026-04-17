import React, { useState } from 'react';
import { useTeam } from '@/components/shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, AlertCircle, CheckCircle2, Settings } from 'lucide-react';

export default function AccountingIntegration() {
  const { currentTeam, isTeamAdmin } = useTeam();
  const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());
  const [exportFormat, setExportFormat] = useState('tripletex');
  const [exporting, setExporting] = useState(false);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam?.id }),
    enabled: !!currentTeam
  });

  if (!isTeamAdmin()) {
    return (
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          Kun administratorer har tilgang til regnskapsintegrasjon
        </AlertDescription>
      </Alert>
    );
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await base44.functions.invoke('exportAccounts', {
        team_id: currentTeam.id,
        format_type: exportFormat,
        year: exportYear
      });

      // Handle file download
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${exportFormat}_export_${exportYear}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Regnskapsintegrasjon</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Konfigurer integrasjoner med eksterne regnskapssystemer
        </p>
      </div>

      {/* Export section */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-600" />
            Eksporter regnskapdata
          </CardTitle>
          <CardDescription>
            Eksporter transaksjonsdata i format kompatibelt med eksterne regnskapssystemer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">System</label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tripletex">Tripletex</SelectItem>
                  <SelectItem value="fiken">Fiken</SelectItem>
                  <SelectItem value="standard">Standard format</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">År</label>
              <Select value={exportYear} onValueChange={setExportYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {exporting ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    Eksporterer...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Eksporter
                  </>
                )}
              </Button>
            </div>
          </div>

          <Alert>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <AlertDescription>
              Eksport inkluderer alle transaksjoner for valgt år i det valgte systemets format
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Integration guide */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Integrasjonsstatus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { name: 'Tripletex', status: 'ready', description: 'CSV-eksport for Tripletex' },
            { name: 'Fiken', status: 'ready', description: 'CSV-eksport for Fiken' }
          ].map(integration => (
            <div key={integration.name} className="p-4 rounded-lg border bg-white dark:bg-slate-900">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{integration.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {integration.description}
                  </p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                  Klar
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Data info */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Datasammendrag</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
              <p className="text-xs text-slate-600 dark:text-slate-400">Totale transaksjoner</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {transactions.length}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
              <p className="text-xs text-slate-600 dark:text-slate-400">År med data</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {new Set(transactions.map(t => new Date(t.date).getFullYear())).size}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
              <p className="text-xs text-slate-600 dark:text-slate-400">Siste eksport</p>
              <p className="text-sm text-slate-900 dark:text-slate-100 mt-1">Aldri</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
              <p className="text-xs text-slate-600 dark:text-slate-400">Status</p>
              <Badge variant="outline" className="mt-1">Aktiv</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}