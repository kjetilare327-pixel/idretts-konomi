import React, { useState } from 'react';
import { useTeam } from '../components/shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import BankImporter from '@/components/bank/BankImporter';
import ReconciliationStatus from '@/components/bank/ReconciliationStatus';
import ReconciliationVisualizer from '@/components/bank/ReconciliationVisualizer';
import MatchingRulesManager from '@/components/bank/MatchingRulesManager';
import AIPaymentMatcher from '@/components/bank/AIPaymentMatcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, CheckCircle2, XCircle, AlertCircle, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function BankReconciliation() {
  const { currentTeam, user } = useTeam();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const { data: bankTransactions = [], refetch: refetchBank } = useQuery({
    queryKey: ['bankTransactions', currentTeam?.id],
    queryFn: () => base44.entities.BankTransaction.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: unreconciledTx = [] } = useQuery({
    queryKey: ['unreconciledTransactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id, reconciled: 'unreconciled' }),
    enabled: !!currentTeam,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims', currentTeam?.id],
    queryFn: () => base44.entities.Claim.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', currentTeam?.id],
    queryFn: () => base44.entities.Player.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const response = await base44.functions.invoke('reconcileBankStatement', {
        team_id: currentTeam.id,
        file_url
      });

      setResult(response.data);
      refetchBank();
    } catch (error) {
      setResult({ 
        success: false, 
        error: error.message || 'Feil ved opplasting' 
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'Dato;Beskrivelse;Beløp;Saldo;KID/Referanse\n15.01.2026;Kontingent John Doe;500,00;10500,00;ABC123\n16.01.2026;Utstyrskjøp;-1200,00;9300,00;';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mal_bankkontoutskrift.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentTeam) {
    return <div className="p-6">Laster...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Bankavstemming</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Last opp bankkontoutskrift for automatisk avstemming av transaksjoner
        </p>
      </div>

      {/* AI Payment Matcher */}
      <AIPaymentMatcher
        teamId={currentTeam?.id}
        bankTransactions={bankTransactions}
        claims={claims}
        players={players}
      />

      {/* Enhanced reconciliation visualizer */}
      <ReconciliationVisualizer teamId={currentTeam?.id} />

      {/* Basic reconciliation status overview */}
      <ReconciliationStatus teamId={currentTeam?.id} />

      {/* Matching rules */}
      <MatchingRulesManager teamId={currentTeam?.id} />

      {/* AI-powered bank importer */}
      <BankImporter teamId={currentTeam?.id} />

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Last opp bankkontoutskrift</CardTitle>
          <CardDescription>
            Last opp CSV-fil fra banken for å automatisk avstemme transaksjoner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Filen må være i CSV-format med kolonnene: Dato;Beskrivelse;Beløp;Saldo;KID/Referanse
              <br />
              Eksempel: 15.01.2026;Kontingent;500,00;10500,00;ABC123
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button variant="outline" onClick={downloadTemplate} className="gap-2">
              <Download className="w-4 h-4" />
              Last ned mal
            </Button>

            <div className="relative flex-1">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Button disabled={uploading} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Laster opp og avstemmer...' : 'Last opp kontoutskrift'}
              </Button>
            </div>
          </div>

          {result && (
            <Alert className={result.success ? 'border-green-200 bg-green-50 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:bg-red-950'}>
              {result.success ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
              <AlertDescription className={result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
                {result.message || result.error}
                {result.success && (
                  <div className="mt-2 space-y-1 text-sm">
                    <div>✓ {result.imported} transaksjoner importert</div>
                    <div>✓ {result.matched_claims} krav markert som betalt</div>
                    <div>✓ {result.reconciled_transactions} transaksjoner avstemt</div>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Unreconciled Transactions */}
      {unreconciledTx.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uavstemt transaksjoner ({unreconciledTx.length})</CardTitle>
            <CardDescription>Transaksjoner som ikke er avstemt mot bankkontoutskrift</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dato</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Beskrivelse</TableHead>
                  <TableHead className="text-right">Beløp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unreconciledTx.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell>{new Date(tx.date).toLocaleDateString('nb-NO')}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === 'income' ? 'default' : 'secondary'}>
                        {tx.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{tx.description}</TableCell>
                    <TableCell className={`text-right font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString('nb-NO')} kr
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Bank Transactions History */}
      <Card>
        <CardHeader>
          <CardTitle>Banktransaksjoner ({bankTransactions.length})</CardTitle>
          <CardDescription>Importerte transaksjoner fra bankkontoutskrift</CardDescription>
        </CardHeader>
        <CardContent>
          {bankTransactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Ingen banktransaksjoner importert ennå
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dato</TableHead>
                  <TableHead>Beskrivelse</TableHead>
                  <TableHead>Referanse</TableHead>
                  <TableHead className="text-right">Beløp</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankTransactions.slice(0, 50).map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell>{new Date(tx.transaction_date).toLocaleDateString('nb-NO')}</TableCell>
                    <TableCell className="max-w-xs truncate">{tx.description}</TableCell>
                    <TableCell className="text-xs text-slate-500">{tx.reference || '-'}</TableCell>
                    <TableCell className={`text-right font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('nb-NO')} kr
                    </TableCell>
                    <TableCell>
                      {tx.reconciled ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Avstemt
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Uavstemt</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}