import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FileSpreadsheet, Upload, Loader2, Download } from 'lucide-react';

export default function CSVImporter({ teamId }) {
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState(null);
  const queryClient = useQueryClient();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
    } else {
      alert('Vennligst velg en CSV-fil');
    }
  };

  const importCSV = async () => {
    if (!file) return;

    setImporting(true);
    try {
      // Upload CSV file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Import transactions
      const response = await base44.functions.invoke('importTransactionsCSV', {
        file_url,
        team_id: teamId
      });

      if (response.data.success) {
        alert(`Import fullført!\n\nImportert: ${response.data.imported}\nHoppet over: ${response.data.skipped}\nFeil: ${response.data.errors.length}`);
        setFile(null);
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }
    } catch (error) {
      alert('Feil ved import: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'date,description,amount,type,category\n2024-01-15,Eksempel utgift,500,expense,Utstyr\n2024-01-20,Eksempel inntekt,1000,income,Kontingent';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transaksjoner_mal.csv';
    a.click();
  };

  return (
    <Card className="border-2 border-dashed border-emerald-300 dark:border-emerald-900">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
              <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-1">Masse-importer transaksjoner</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Last opp CSV-fil med historiske transaksjoner
            </p>
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Last ned mal
            </Button>

            <div>
              <label htmlFor="csv-upload" className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed hover:border-emerald-500 transition-colors">
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {file ? file.name : 'Velg CSV-fil'}
                  </span>
                </div>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <Button
              onClick={importCSV}
              disabled={!file || importing}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importerer...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  Importer CSV
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-slate-500">
            CSV må inneholde: date, amount (påkrevd). Valgfrie: description, type, category
          </p>
        </div>
      </CardContent>
    </Card>
  );
}