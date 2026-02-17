import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Upload, Loader2, CheckCircle2 } from 'lucide-react';

export default function ReceiptScanner({ teamId, onDataExtracted }) {
  const [scanning, setScanning] = useState(false);
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const scanReceipt = async () => {
    if (!file) return;

    setScanning(true);
    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Scan with OCR
      const response = await base44.functions.invoke('scanReceiptOCR', {
        file_url,
        team_id: teamId
      });

      if (response.data.success) {
        onDataExtracted(response.data.extracted_data);
        setFile(null);
      }
    } catch (error) {
      alert('Feil ved skanning: ' + error.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-blue-300 dark:border-blue-900">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <Camera className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-1">Skann kvittering med AI</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Last opp bilde av kvittering for automatisk datauthenting
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="receipt-upload" className="cursor-pointer">
              <div className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed hover:border-blue-500 transition-colors">
                <Upload className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {file ? file.name : 'Velg bilde'}
                </span>
              </div>
              <Input
                id="receipt-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </Label>

            <Button
              onClick={scanReceipt}
              disabled={!file || scanning}
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Skanner...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Skann kvittering
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}