import React, { useState, useMemo } from 'react';
import { useTeam } from '../components/shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Loader2, Mail, Users, CheckCircle2, AlertCircle, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TemplateManager from '../components/communications/TemplateManager';
import MessageTracker from '../components/communications/MessageTracker';
import RecipientSegmentation from '../components/communications/RecipientSegmentation';


const MESSAGE_TEMPLATES = {
  training_change: {
    name: 'Treningsendring',
    subject: 'Endring i treningsplan',
    body: 'Hei [navn],\n\nVi ønsker å informere om en endring i treningsplanen:\n\n[detaljer]\n\nVennlig hilsen,\n[lag]'
  },
  match_invitation: {
    name: 'Kampinvitasjon',
    subject: 'Kampinvitasjon',
    body: 'Hei [navn],\n\nDu er invitert til følgende kamp:\n\nMotstander: [motstander]\nDato: [dato]\nKlokkeslett: [tid]\nSted: [sted]\n\nBekreft deltakelse så snart som mulig.\n\nVennlig hilsen,\n[lag]'
  },
  payment_reminder: {
    name: 'Betalingspåminnelse',
    subject: 'Påminnelse om betaling',
    body: 'Hei [navn],\n\nDette er en påminnelse om ubetalt saldo.\n\nBeløp: [beløp]\nForfallsdato: [forfallsdato]\n\nVennligst betal så snart som mulig.\n\nVennlig hilsen,\n[lag]'
  },
  general_info: {
    name: 'Generell informasjon',
    subject: 'Informasjon fra laget',
    body: 'Hei [navn],\n\n[melding]\n\nVennlig hilsen,\n[lag]'
  },
  event_announcement: {
    name: 'Arrangementsannonsering',
    subject: 'Nytt arrangement',
    body: 'Hei [navn],\n\nVi inviterer til følgende arrangement:\n\nArrangement: [arrangement]\nDato: [dato]\nKlokkeslett: [tid]\nSted: [sted]\n\nPåmelding til: [kontakt]\n\nVennlig hilsen,\n[lag]'
  }
};

export default function Communications() {
  const { currentTeam, user, isTeamAdmin } = useTeam();
  const [template, setTemplate] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [recipientType, setRecipientType] = useState('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);


  const { data: players = [] } = useQuery({
    queryKey: ['players', currentTeam?.id],
    queryFn: () => base44.entities.Player.filter({ team_id: currentTeam.id, status: 'active' }),
    enabled: !!currentTeam,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims', currentTeam?.id],
    queryFn: () => base44.entities.Claim.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: allTransactions = [] } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const recipients = useMemo(() => {
    if (recipientType === 'all') {
      return players.map(p => ({ email: p.user_email, name: p.full_name, role: p.role }));
    }
    if (recipientType === 'players') {
      return players.filter(p => p.role === 'player').map(p => ({ email: p.user_email, name: p.full_name, role: p.role }));
    }
    if (recipientType === 'parents') {
      return players.filter(p => p.role === 'parent').map(p => ({ email: p.user_email, name: p.full_name, role: p.role }));
    }
    if (recipientType === 'unpaid') {
      return players.filter(p => p.payment_status === 'unpaid' || p.payment_status === 'partial')
        .map(p => ({ email: p.user_email, name: p.full_name, role: p.role }));
    }
    if (recipientType === 'custom') {
      return selectedRecipients.map(email => {
        const player = players.find(p => p.user_email === email);
        return { email, name: player?.full_name || email, role: player?.role };
      });
    }
    return [];
  }, [recipientType, players, selectedRecipients]);

  const handleTemplateChange = (templateKey) => {
    setTemplate(templateKey);
    if (templateKey && MESSAGE_TEMPLATES[templateKey]) {
      setSubject(MESSAGE_TEMPLATES[templateKey].subject);
      setMessage(MESSAGE_TEMPLATES[templateKey].body);
    }
  };

  const toggleRecipient = (email) => {
    setSelectedRecipients(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleTemplateSelect = (template) => {
    const body = template.body
      .replace(/\{\{name\}\}/g, '[navn]')
      .replace(/\{\{team\}\}/g, '[lag]')
      .replace(/\{\{amount\}\}/g, '[beløp]')
      .replace(/\{\{date\}\}/g, '[dato]')
      .replace(/\{\{event\}\}/g, '[arrangement]');
    
    setSubject(template.subject);
    setMessage(body);
  };

  const handleSend = async () => {
    if (!subject || !message || recipients.length === 0) {
      setResult({ success: false, message: 'Vennligst fyll ut alle felt og velg mottakere' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      let successCount = 0;
      let failedCount = 0;

      for (const recipient of recipients) {
        try {
          const personalizedMessage = message
            .replace(/\[navn\]/g, recipient.name)
            .replace(/\[lag\]/g, currentTeam.name);

          await base44.integrations.Core.SendEmail({
            to: recipient.email,
            subject: subject,
            body: personalizedMessage.replace(/\n/g, '<br>')
          });

          // Track sent message
          await base44.entities.SentMessage.create({
            team_id: currentTeam.id,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            subject: subject,
            body: personalizedMessage,
            status: 'sent',
            sent_at: new Date().toISOString(),
            segment: recipientType
          });

          successCount++;
        } catch (error) {
          console.error(`Failed to send to ${recipient.email}:`, error);
          
          // Track failed message
          await base44.entities.SentMessage.create({
            team_id: currentTeam.id,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            subject: subject,
            body: message,
            status: 'failed',
            sent_at: new Date().toISOString(),
            error_message: error.message,
            segment: recipientType
          });

          failedCount++;
        }
      }

      setResult({
        success: true,
        message: `Sendt til ${successCount} av ${recipients.length} mottakere${failedCount > 0 ? ` (${failedCount} feilet)` : ''}`
      });

      // Reset form
      setSubject('');
      setMessage('');
      setTemplate('');
      setRecipientType('all');
      setSelectedRecipients([]);
    } catch (error) {
      setResult({ success: false, message: error.message || 'Feil ved sending' });
    } finally {
      setSending(false);
    }
  };

  if (!currentTeam) {
    return <div className="p-6">Laster...</div>;
  }

  if (!isTeamAdmin()) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Kun administratorer har tilgang til kommunikasjonsmodulen.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Kommunikasjon</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Send betalingspåminnelser og finansiell informasjon til medlemmer
        </p>
      </div>

      <Tabs defaultValue="compose" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="compose">
            <Send className="w-4 h-4 mr-1.5" />
            Send melding
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Mail className="w-4 h-4 mr-1.5" />
            Maler
          </TabsTrigger>
          <TabsTrigger value="tracking">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Sporing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6">{/* Existing compose content */}

      {result && (
        <Alert className={result.success ? 'border-green-200 bg-green-50 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:bg-red-950'}>
          {result.success ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <AlertDescription className={result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
            {result.message}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message Composition */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ny melding</CardTitle>
            <CardDescription>Skriv melding til mottakere</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mal (valgfritt)</Label>
              <Select value={template} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg mal eller skriv egen melding" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Ingen mal</SelectItem>
                  {Object.entries(MESSAGE_TEMPLATES).map(([key, tmpl]) => (
                    <SelectItem key={key} value={key}>{tmpl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Emne</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Skriv emne..."
              />
            </div>

            <div className="space-y-2">
              <Label>Melding</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Skriv melding her..."
                className="min-h-[250px]"
              />
              <p className="text-xs text-slate-500">
                Tips: Bruk [navn] for å personalisere med mottakerens navn, og [lag] for lagets navn.
              </p>
            </div>

            <Button 
              onClick={handleSend} 
              disabled={sending || !subject || !message || recipients.length === 0}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sender...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send til {recipients.length} mottaker{recipients.length !== 1 ? 'e' : ''}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Recipients */}
        <Card>
          <CardHeader>
            <CardTitle>Mottakere</CardTitle>
            <CardDescription>Velg hvem som skal motta meldingen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type mottakere</Label>
              <Select value={recipientType} onValueChange={setRecipientType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Alle ({players.length})
                    </div>
                  </SelectItem>
                  <SelectItem value="players">
                    Kun spillere ({players.filter(p => p.role === 'player').length})
                  </SelectItem>
                  <SelectItem value="parents">
                    Kun foreldre ({players.filter(p => p.role === 'parent').length})
                  </SelectItem>
                  <SelectItem value="unpaid">
                    Kun ubetalt ({players.filter(p => p.payment_status !== 'paid').length})
                  </SelectItem>
                  <SelectItem value="custom">Velg selv</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {recipientType === 'custom' && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <Label>Velg spillere/foreldre</Label>
                {players.map(player => (
                  <div key={player.id} className="flex items-center gap-2">
                    <Checkbox
                      id={player.id}
                      checked={selectedRecipients.includes(player.user_email)}
                      onCheckedChange={() => toggleRecipient(player.user_email)}
                    />
                    <label htmlFor={player.id} className="text-sm cursor-pointer flex-1">
                      {player.full_name}
                      <Badge variant="outline" className="ml-2 text-xs">
                        {player.role === 'player' ? 'Spiller' : 'Forelder'}
                      </Badge>
                    </label>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-slate-500" />
                <span className="font-medium">{recipients.length}</span>
                <span className="text-slate-500">valgte mottakere</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Communication Strategies */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI Kommunikasjonsstrategier
              </CardTitle>
              <CardDescription>Personlige forslag basert på medlemsaktivitet og betalingshistorikk</CardDescription>
            </div>
            <Button onClick={loadAiStrategies} disabled={loadingStrategies} variant="outline" className="gap-2">
              {loadingStrategies ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              Analyser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiStrategies ? (
            <div className="space-y-4">
              {aiStrategies.summary && (
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
                  <p className="text-sm text-slate-700 dark:text-slate-300">{aiStrategies.summary}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiStrategies.strategies?.map((strategy, idx) => (
                  <div key={idx} className="p-4 rounded-lg border bg-white dark:bg-slate-900 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm">{strategy.title}</h3>
                      <Badge variant="outline" className="text-xs">{strategy.channel}</Badge>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{strategy.message_tone}</p>
                    <p className="text-xs mb-3 line-clamp-2">{strategy.suggested_content}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>📅 {strategy.optimal_timing}</span>
                      <Button size="sm" variant="ghost" onClick={() => applyStrategy(strategy)} className="h-7 text-xs">
                        Bruk
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {aiStrategies.segments && (
                <div className="flex flex-wrap gap-2 pt-3 border-t">
                  <Badge variant="outline">Høy risiko: {aiStrategies.segments.high_risk}</Badge>
                  <Badge variant="outline">Middels risiko: {aiStrategies.segments.medium_risk}</Badge>
                  <Badge variant="outline">God status: {aiStrategies.segments.good_standing}</Badge>
                  <Badge variant="outline">Trege betalere: {aiStrategies.segments.slow_payers}</Badge>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">Klikk på "Analyser" for å få AI-baserte kommunikasjonsstrategier</p>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="templates">
          <TemplateManager teamId={currentTeam?.id} onSelectTemplate={handleTemplateSelect} />
        </TabsContent>

        <TabsContent value="tracking">
          <MessageTracker teamId={currentTeam?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}