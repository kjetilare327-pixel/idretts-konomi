import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTeam } from '@/components/shared/TeamContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollText, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 50;

export default function AuditLog() {
  const { currentTeam } = useTeam();
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [page, setPage] = useState(0);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditlogs', currentTeam?.id],
    queryFn: () => base44.entities.AuditLog.filter({ team_id: currentTeam.id }, '-timestamp', 500),
    enabled: !!currentTeam,
  });

  const filtered = useMemo(() => {
    return logs
      .filter(l => {
        const matchSearch = !search ||
          l.user_email?.toLowerCase().includes(search.toLowerCase()) ||
          l.description?.toLowerCase().includes(search.toLowerCase()) ||
          l.entity_type?.toLowerCase().includes(search.toLowerCase());
        const matchAction = filterAction === 'all' || l.action === filterAction;
        return matchSearch && matchAction;
      })
      .sort((a, b) => new Date(b.timestamp || b.created_date) - new Date(a.timestamp || a.created_date));
  }, [logs, search, filterAction]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const actionColors = {
    create: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400',
    update: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400',
    delete: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400',
    annull: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400',
    approve: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400',
    reject: 'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-emerald-500" /> Revisjonslogg
        </h1>
        <p className="text-sm text-slate-500">
          Sporbar historikk over alle endringer{currentTeam ? ` for ${currentTeam.name}` : ''}
          {filtered.length > 0 && ` – ${filtered.length} oppføringer`}
        </p>
      </div>

      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Søk bruker, handling eller entitet..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="pl-10"
              />
            </div>
            <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle handlinger</SelectItem>
                <SelectItem value="create">Opprettet</SelectItem>
                <SelectItem value="update">Endret</SelectItem>
                <SelectItem value="delete">Slettet</SelectItem>
                <SelectItem value="annull">Annullert</SelectItem>
                <SelectItem value="approve">Godkjent</SelectItem>
                <SelectItem value="reject">Avvist</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead>Tidspunkt</TableHead>
                  <TableHead>Bruker</TableHead>
                  <TableHead>Handling</TableHead>
                  <TableHead>Entitet</TableHead>
                  <TableHead>Beskrivelse</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
                    </TableCell>
                  </TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                      {search || filterAction !== 'all' ? 'Ingen logger matchet filteret' : 'Ingen handlinger registrert ennå'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map(log => (
                    <TableRow key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp || log.created_date).toLocaleString('nb-NO', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{log.user_email?.split('@')[0]}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${actionColors[log.action] || 'bg-slate-100 text-slate-800'}`}>
                          {log.action === 'create' ? 'Opprettet' :
                           log.action === 'update' ? 'Endret' :
                           log.action === 'delete' ? 'Slettet' :
                           log.action === 'annull' ? 'Annullert' :
                           log.action === 'approve' ? 'Godkjent' :
                           log.action === 'reject' ? 'Avvist' : log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {log.entity_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate text-slate-500">{log.description || '–'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-500">
                Side {page + 1} av {totalPages} ({filtered.length} oppføringer)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}