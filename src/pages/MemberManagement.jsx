import React, { useState, useMemo } from 'react';
import { useTeam } from '../components/shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Search, Filter, Mail, TrendingUp, TrendingDown, Clock, CheckCircle2, AlertCircle, User, Receipt, MessageSquare } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function MemberManagement() {
  const { currentTeam, isTeamAdmin } = useTeam();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [selectedMember, setSelectedMember] = useState(null);

  const { data: players = [] } = useQuery({
    queryKey: ['players', currentTeam?.id],
    queryFn: () => base44.entities.Player.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims', currentTeam?.id],
    queryFn: () => base44.entities.Claim.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs', currentTeam?.id],
    queryFn: () => base44.entities.AuditLog.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  // Segment members
  const segments = useMemo(() => {
    const active = players.filter(p => p.status === 'active');
    const unpaid = active.filter(p => p.payment_status === 'unpaid' || p.payment_status === 'partial');
    const highDebt = active.filter(p => (p.balance || 0) > 5000);
    const playersOnly = active.filter(p => p.role === 'player');
    const parentsOnly = active.filter(p => p.role === 'parent');
    
    return {
      all: active.length,
      unpaid: unpaid.length,
      high_debt: highDebt.length,
      players: playersOnly.length,
      parents: parentsOnly.length
    };
  }, [players]);

  // Filter and search
  const filteredMembers = useMemo(() => {
    return players.filter(p => {
      if (p.status !== 'active') return false;
      
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.full_name.toLowerCase().includes(q) && 
            !p.user_email.toLowerCase().includes(q)) {
          return false;
        }
      }
      
      // Payment status filter
      if (filterStatus === 'paid' && p.payment_status !== 'paid') return false;
      if (filterStatus === 'unpaid' && p.payment_status === 'paid') return false;
      if (filterStatus === 'high_debt' && (p.balance || 0) <= 5000) return false;
      
      // Role filter
      if (filterRole !== 'all' && p.role !== filterRole) return false;
      
      return true;
    });
  }, [players, searchQuery, filterStatus, filterRole]);

  const getMemberDetails = (playerId) => {
    const memberClaims = claims.filter(c => c.player_id === playerId);
    const memberTransactions = transactions.filter(t => t.player_id === playerId);
    const memberLogs = auditLogs.filter(l => l.entity_type === 'Player' && l.entity_id === playerId);
    
    return {
      claims: memberClaims,
      transactions: memberTransactions,
      logs: memberLogs,
      totalPaid: memberClaims.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0),
      totalUnpaid: memberClaims.filter(c => c.status !== 'paid').reduce((sum, c) => sum + c.amount, 0),
      lastActivity: memberLogs.length > 0 ? new Date(memberLogs[0].created_date).toLocaleDateString('nb-NO') : 'Ingen aktivitet'
    };
  };

  if (!currentTeam) return <div className="p-6">Laster...</div>;

  if (!isTeamAdmin()) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Kun administratorer har tilgang til medlemsadministrasjon.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Medlemsadministrasjon</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Administrer medlemmer, se detaljer og segmenter
        </p>
      </div>

      {/* Segments overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-0 shadow-sm dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Totalt</p>
                <p className="text-2xl font-bold">{segments.all}</p>
              </div>
              <Users className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Ubetalt</p>
                <p className="text-2xl font-bold text-amber-600">{segments.unpaid}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Høy gjeld</p>
                <p className="text-2xl font-bold text-red-600">{segments.high_debt}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Spillere</p>
                <p className="text-2xl font-bold text-blue-600">{segments.players}</p>
              </div>
              <User className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Foreldre</p>
                <p className="text-2xl font-bold text-purple-600">{segments.parents}</p>
              </div>
              <Users className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and filters */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle>Søk og filtrer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Søk etter navn eller e-post..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle betalingsstatuser</SelectItem>
                <SelectItem value="paid">Betalt</SelectItem>
                <SelectItem value="unpaid">Ubetalt</SelectItem>
                <SelectItem value="high_debt">Høy gjeld (>5000 kr)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle roller</SelectItem>
                <SelectItem value="player">Spillere</SelectItem>
                <SelectItem value="parent">Foreldre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Members table */}
      <Card className="border-0 shadow-md dark:bg-slate-900">
        <CardHeader>
          <CardTitle>Medlemmer ({filteredMembers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map(member => (
                <TableRow key={member.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <TableCell className="font-medium">{member.full_name}</TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-400">{member.user_email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {member.role === 'player' ? 'Spiller' : 'Forelder'}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${(member.balance || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatNOK(Math.abs(member.balance || 0))}
                  </TableCell>
                  <TableCell>
                    {member.payment_status === 'paid' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Betalt
                      </Badge>
                    ) : member.payment_status === 'partial' ? (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950">
                        <Clock className="w-3 h-3 mr-1" />
                        Delvis
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-950">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Ubetalt
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedMember(member)}
                    >
                      Se detaljer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Ingen medlemmer funnet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Member detail dialog */}
      {selectedMember && (
        <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {selectedMember.full_name}
              </DialogTitle>
              <DialogDescription>
                {selectedMember.user_email} • {selectedMember.role === 'player' ? 'Spiller' : 'Forelder'}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Oversikt</TabsTrigger>
                <TabsTrigger value="claims">Krav</TabsTrigger>
                <TabsTrigger value="transactions">Transaksjoner</TabsTrigger>
                <TabsTrigger value="activity">Aktivitet</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-slate-500 mb-1">Saldo</p>
                      <p className={`text-2xl font-bold ${(selectedMember.balance || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {(selectedMember.balance || 0) > 0 ? 'Skylder ' : 'Kreditt '}
                        {formatNOK(Math.abs(selectedMember.balance || 0))}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-slate-500 mb-1">Betalingsstatus</p>
                      <p className="text-2xl font-bold">
                        {selectedMember.payment_status === 'paid' ? '✓ Betalt' : 
                         selectedMember.payment_status === 'partial' ? '◐ Delvis' : '✗ Ubetalt'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Telefon:</span>
                        <span className="font-medium">{selectedMember.phone || 'Ikke oppgitt'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Notater:</span>
                        <span className="font-medium">{selectedMember.notes || 'Ingen notater'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Registrert:</span>
                        <span className="font-medium">{new Date(selectedMember.created_date).toLocaleDateString('nb-NO')}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="claims">
                {(() => {
                  const memberClaims = claims.filter(c => c.player_id === selectedMember.id);
                  return memberClaims.length > 0 ? (
                    <div className="space-y-2">
                      {memberClaims.map(claim => (
                        <Card key={claim.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{claim.type}</p>
                                <p className="text-sm text-slate-500">{claim.description}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  Forfaller: {new Date(claim.due_date).toLocaleDateString('nb-NO')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg">{formatNOK(claim.amount)}</p>
                                <Badge className={
                                  claim.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                  claim.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                  'bg-amber-100 text-amber-700'
                                }>
                                  {claim.status === 'paid' ? 'Betalt' : claim.status === 'overdue' ? 'Forfalt' : 'Ventende'}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-slate-500">Ingen krav registrert</p>
                  );
                })()}
              </TabsContent>

              <TabsContent value="transactions">
                {(() => {
                  const memberTransactions = transactions.filter(t => t.player_id === selectedMember.id);
                  return memberTransactions.length > 0 ? (
                    <div className="space-y-2">
                      {memberTransactions.map(tx => (
                        <Card key={tx.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{tx.category}</p>
                                <p className="text-sm text-slate-500">{tx.description}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {new Date(tx.date).toLocaleDateString('nb-NO')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`font-bold text-lg ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {tx.type === 'income' ? '+' : '-'}{formatNOK(tx.amount)}
                                </p>
                                <Badge variant="outline">
                                  {tx.type === 'income' ? 'Inntekt' : 'Utgift'}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-slate-500">Ingen transaksjoner registrert</p>
                  );
                })()}
              </TabsContent>

              <TabsContent value="activity">
                {(() => {
                  const memberLogs = auditLogs.filter(l => 
                    (l.entity_type === 'Player' && l.entity_id === selectedMember.id) ||
                    (l.entity_type === 'Claim' && claims.some(c => c.id === l.entity_id && c.player_id === selectedMember.id))
                  );
                  return memberLogs.length > 0 ? (
                    <div className="space-y-2">
                      {memberLogs.slice(0, 20).map(log => (
                        <Card key={log.id}>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <MessageSquare className="w-4 h-4 text-slate-400 mt-1" />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{log.action}</p>
                                <p className="text-xs text-slate-500">{log.description}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {new Date(log.timestamp || log.created_date).toLocaleString('nb-NO')} • {log.user_email}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-slate-500">Ingen aktivitet registrert</p>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}