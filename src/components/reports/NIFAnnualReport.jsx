import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileDown, Loader2, CheckCircle2, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function NIFAnnualReport({ teamId, teamName }) {
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    setSuccess(false);

    try {
      const response = await base44.functions.invoke('generateNIFAnnualReport', {
        teamId,
        year: parseInt(year)
      });

      // Opprett en blob og last ned PDF
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arsrapport_${teamName}_${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Kunne ikke generere rapport. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
            <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-lg">NIF-kompatibel årsrapport</CardTitle>
            <CardDescription>
              Generer fullstendig årsrapport tilpasset krav fra Norges idrettsforbund
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {success && (
          <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-200">
              Årsrapporten ble generert og lastet ned!
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Velg regnskapsår</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Rapporten inkluderer:
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 ml-4">
              <li>• Komplett resultatregnskap med alle kategorier</li>
              <li>• NIF-spesifikk inntektsfordeling (skattefrie vs. skattepliktige)</li>
              <li>• MVA-informasjon og momsfritak for idrett</li>
              <li>• Budsjett vs. regnskap sammenligning</li>
              <li>• Organisasjonsinformasjon og medlemstall</li>
              <li>• Regnskapsstandarder for ideelle organisasjoner</li>
            </ul>
          </div>

          <Button 
            onClick={generateReport} 
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Genererer rapport...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                Generer og last ned årsrapport
              </>
            )}
          </Button>

          <p className="text-xs text-slate-500 text-center">
            Rapporten genereres som PDF og er klar til innsending til NIF eller revisor
          </p>
        </div>
      </CardContent>
    </Card>
  );
}