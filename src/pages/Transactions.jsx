import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTeam } from '@/components/shared/TeamContext';
import { formatNOK, formatDate, ALL_CATEGORIES } from '@/components/shared/FormatUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, ArrowUpDown, Trash2, Pencil, ArrowUpRight, ArrowDownRight, Paperclip, Loader2, Sparkles } from 'lucide-react';
import TransactionForm from '@/components/transactions/TransactionForm';
import ReceiptScanner from '@/components/transactions/ReceiptScanner';
import CSVImporter from '@/components/transactions/CSVImporter';
import AiTransactionAssistant from '@/components/transactions/AiTransactionAssistant';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PullToRefresh from '@/components/mobile/PullToRefresh';

export default function Transactions() {
  const { currentTeam } = useTeam();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('manual'); // 'manual' | 'ai'
  const [editData, setEditData] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState(-1);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id }, '-date'),
    enabled: !!currentTeam,
  });

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['transactions', currentTeam?.id] });
  };

  const filtered = useMemo(() => {
    let list = [...transactions];
    if (filterType !== 'all') list = list.filter(t => t.type === filterType);
    if (filterCategory !== 'all') list = list.filter(t => t.category === filterCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.description?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === 'amount') { va = Number(va); vb = Number(vb); }
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
    return list;
  }, [transactions, filterType, filterCategory, search, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d * -1);
    else { setSortField(field); setSortDir(-1); }
  };

  const handleDelete = async (id) => {
    await base44.entities.Transaction.delete(id);
    queryClient.invalidateQueries({ queryKey: ['transactions', currentTeam?.id] });
  };

  const openEdit = (t) => { setEditData(t); setShowForm(true); };
  const openNew = (mode = 'manual') => { setEditData(null); setFormMode(mode); setShowForm(true); };

  if (!currentTeam) return <p className="text-center py-12 text-slate-500">Velg et lag for å se transaksjoner.</p>;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transaksjoner</h1>
          <p className="text-sm text-slate-500">{filtered.length} transaksjoner</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openNew('ai')} variant="outline" className="gap-2 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-400 dark:hover:bg-violet-500/10">
            <Sparkles className="w-4 h-4" /> AI-fordeling
          </Button>
          <Button onClick={() => openNew('manual')} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Plus className="w-4 h-4" /> Ny transaksjon
          </Button>
        </div>
      </div>

      {/* OCR Scanner and CSV Importer */}
      <div className="grid md:grid-cols-2 gap-4">
        <ReceiptScanner 
          teamId={currentTeam.id}
          onDataExtracted={(data) => {
            setEditData({
              type: 'expense',
              category: data.category,
              amount: data.amount,
              date: data.date,
              description: data.description,
              attachment_url: data.attachment_url
            });
            setShowForm(true);
          }}
        />
        <CSVImporter teamId={currentTeam.id} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Søk i beskrivelse..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle typer</SelectItem>
            <SelectItem value="income">Inntekter</SelectItem>
            <SelectItem value="expense">Utgifter</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kategorier</SelectItem>
            {ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-md dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead className="cursor-pointer" onClick={() => handleSort('date')}>
                  <span className="flex items-center gap-1">Dato <ArrowUpDown className="w-3 h-3" /></span>
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('amount')}>
                  <span className="flex items-center gap-1">Beløp <ArrowUpDown className="w-3 h-3" /></span>
                </TableHead>
                <TableHead className="hidden md:table-cell">Beskrivelse</TableHead>
                <TableHead className="w-24">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400">Ingen transaksjoner funnet</TableCell></TableRow>
              ) : filtered.map(t => (
                <TableRow key={t.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <TableCell className="text-sm">{formatDate(t.date)}</TableCell>
                  <TableCell>
                    {t.type === 'income' ? (
                      <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                  </TableCell>
                  <TableCell className={`font-semibold text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '−'}{formatNOK(t.amount)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-slate-500 max-w-[200px] truncate">
                    <div className="flex items-center gap-1">
                      {t.description || '–'}
                      {t.attachment_url && <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editData?.id ? 'Rediger transaksjon' : (
                formMode === 'ai'
                  ? <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /> AI-transaksjonsassistent</span>
                  : 'Ny transaksjon'
              )}
            </DialogTitle>
          </DialogHeader>

          {!editData?.id && (
            <Tabs value={formMode} onValueChange={setFormMode} className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="manual" className="flex-1">Manuell</TabsTrigger>
                <TabsTrigger value="ai" className="flex-1 gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI-fordeling
                </TabsTrigger>
              </TabsList>
              <TabsContent value="manual">
                <TransactionForm
                  teamId={currentTeam.id}
                  editData={editData}
                  onClose={() => setShowForm(false)}
                  onSaved={() => {
                    setShowForm(false);
                    queryClient.invalidateQueries({ queryKey: ['transactions', currentTeam?.id] });
                    queryClient.invalidateQueries({ queryKey: ['players', currentTeam?.id] });
                  }}
                />
              </TabsContent>
              <TabsContent value="ai">
                <AiTransactionAssistant
                  teamId={currentTeam.id}
                  onDone={() => {
                    setShowForm(false);
                    queryClient.invalidateQueries({ queryKey: ['transactions', currentTeam?.id] });
                    queryClient.invalidateQueries({ queryKey: ['players', currentTeam?.id] });
                    queryClient.invalidateQueries({ queryKey: ['claims', currentTeam?.id] });
                  }}
                />
              </TabsContent>
            </Tabs>
          )}

          {editData?.id && (
            <TransactionForm
              teamId={currentTeam.id}
              editData={editData}
              onClose={() => setShowForm(false)}
              onSaved={() => {
                setShowForm(false);
                queryClient.invalidateQueries({ queryKey: ['transactions', currentTeam?.id] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
}