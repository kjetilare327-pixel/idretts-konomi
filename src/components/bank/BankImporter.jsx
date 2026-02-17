import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function BankImporter({ teamId }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      // Les CSV-filen
      const text = await file.text();
      const lines = text.trim().split('\n');
      
      // Anta CSV-format: dato, beskrivelse, beløp, referanse
      const transactions = [];
      for (let i = 1; i < lines.length; i++) { // Skip header
        const line = lines[i];
        const parts = line.split(/[,;]/); // Support både comma og semicolon
        
        if (parts.length >= 3) {
          transactions.push({
            date: parts[0].trim(),
            description: parts[1].trim(),
            amount: parseFloat(parts[2].trim().replace(/[^\d.-]/g, '')),
            reference: parts[3]?.trim() || null
          });
        }
      }

      if (transactions.length === 0) {
        setResult({ error: 'Ingen transaksjoner funnet i filen' });
        setUploading(false);
        return;
      }

      // Send til backend for AI-kategorisering
      const response = await base44.functions.invoke('importBankTransactions', {
        teamId,
        transactions
      });

      setResult(response.data);
      
      // Oppdater query cache
      queryClient.invalidateQueries({ queryKey: ['bank-transactions', teamId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', teamId] });
      queryClient.invalidateQueries({ queryKey: ['claims', teamId] });
      
      setFile(null);
      
    } catch (error) {
      console.error('Import failed:', error);
      setResult({ error: 'Import feilet. Sjekk filformatet og prøv igjen.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Importer banktransaksjoner</CardTitle>
            <CardDescription>
              Last opp CSV fra banken - AI kategoriserer automatisk
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {result && (
          <Alert className={result.error 
            ? "border-red-200 bg-red-50 dark:bg-red-900/20" 
            : "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20"
          }>
            {result.error ? (
              <>
                <AlertCircle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  {result.error}
                </AlertDescription>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                  <div className="space-y-1">
                    <p className="font-medium">Import fullført!</p>
                    <p className="text-sm">
                      {result.imported} transaksjoner importert
                      {result.autoApproved > 0 && ` • ${result.autoApproved} automatisk godkjent`}
                      {result.needsReview > 0 && ` • ${result.needsReview} krever gjennomgang`}
                    </p>
                  </div>
                </AlertDescription>
              </>
            )}
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploading}
              className="flex-1"
            />
            <Button 
              onClick={handleImport}
              disabled={!file || uploading}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importerer...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Importer
                </>
              )}
            </Button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                AI-drevet kategorisering
              </p>
            </div>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 ml-6">
              <li>• Automatisk matching mot åpne fakturaer (KID-nummer)</li>
              <li>• Intelligent kategorisering basert på beskrivelse</li>
              <li>• Lærer fra tidligere transaksjoner</li>
              <li>• Godkjenner automatisk transaksjoner med høy sikkerhet</li>
            </ul>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              CSV-format (eksempel):
            </p>
            <pre className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 rounded p-2 overflow-x-auto">
{`Dato,Beskrivelse,Beløp,Referanse
2024-01-15,Medlemskontingent,5000,1234567
2024-01-16,Utstyrskjøp,-2500,INV-123`}
            </pre>
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-500">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              For PSD2-bankintegrasjon med automatisk synkronisering, kontakt support for å sette opp API-tilgang.
              De fleste norske banker støtter PSD2-APIer for sikker tilgang.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}