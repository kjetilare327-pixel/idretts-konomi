import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, X, Send, Minimize2, Maximize2, Loader2, Sparkles, HelpCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const QUICK_QUESTIONS = [
  { label: '➕ Ny transaksjon', query: 'Hvordan legger jeg til en ny transaksjon?' },
  { label: '🤖 AI-fordeling', query: 'Hvordan fungerer AI-fordeling av utgifter på spillere?' },
  { label: '📊 Budsjett', query: 'Hvordan oppretter jeg en budsjettpost?' },
  { label: '🏦 Bankavstemming', query: 'Hvordan importerer jeg kontoutskrift for bankavstemming?' },
  { label: '📋 Fakturering', query: 'Hvordan sender jeg faktura til spillere?' },
  { label: '📈 Rapporter', query: 'Hvilke rapporter er tilgjengelige og hvordan eksporterer jeg dem?' },
  { label: '👥 Spillersaldo', query: 'Hvordan fungerer spillersaldo og krav?' },
  { label: '📧 Kommunikasjon', query: 'Hvordan sender jeg e-post til alle spillere?' },
  { label: '🔔 Varsler', query: 'Hvordan fungerer AI-varsler i appen?' },
  { label: '⚙️ Roller & tilgang', query: 'Hva er forskjellen på de ulike brukerrollene i appen?' },
];

export default function SupportChatbot({ teamId }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open && !conversation) initConversation();
    if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, minimized]);

  const initConversation = async () => {
    setInitError(false);
    try {
      const conv = await base44.agents.createConversation({
        agent_name: 'support_chatbot',
        metadata: { team_id: teamId, name: 'App Help Chat' },
      });
      setConversation(conv);
      setMessages([{
        role: 'assistant',
        content: '👋 Hei! Jeg er din AI-hjelpeassistent for **IdrettsØkonomi**.\n\nJeg svarer kun på spørsmål om appens funksjoner – alt fra transaksjoner og budsjett til rapporter og roller.\n\n💡 Velg et hurtigspørsmål nedenfor, eller skriv ditt eget!',
      }]);
    } catch {
      setInitError(true);
    }
  };

  useEffect(() => {
    if (!conversation) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      setLoading(false);
    });
    return () => unsub();
  }, [conversation?.id]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || !conversation || loading) return;
    setInput('');
    setLoading(true);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Beklager, noe gikk galt. Prøv igjen.' }]);
      setLoading(false);
    }
  };

  const handleQuick = (query) => {
    sendMessage(query);
  };

  const showQuickButtons = messages.length <= 1;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Få hjelp med appen"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 z-50 flex items-center justify-center transition-all hover:scale-105"
      >
        <HelpCircle className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-200 ${minimized ? 'w-72' : 'w-96'}`}>
      <Card className="shadow-2xl overflow-hidden border border-indigo-200 dark:border-indigo-900 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">App-hjelp AI</p>
              <p className="text-xs text-indigo-200">Spør om appens funksjoner</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => setMinimized(!minimized)}>
              {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => setOpen(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {!minimized && (
          <>
            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950 flex flex-col">
              {initError ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                  <MessageCircle className="w-8 h-8" />
                  <p className="text-sm text-center">Kunne ikke starte chat. <button className="text-indigo-500 underline" onClick={initConversation}>Prøv igjen</button></p>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 mb-1">
                          <Sparkles className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-bl-sm'
                      }`}>
                        {msg.role === 'user' ? (
                          <p>{msg.content}</p>
                        ) : (
                          <ReactMarkdown
                            className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:text-sm"
                            components={{
                              p: ({ children }) => <p className="mb-1 last:mb-0 leading-snug">{children}</p>,
                              ul: ({ children }) => <ul className="mb-1 ml-3 list-disc">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-1 ml-3 list-decimal">{children}</ol>,
                              li: ({ children }) => <li className="mb-0.5">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex items-end gap-2 justify-start">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-3 h-3 text-white" />
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-sm px-3 py-2">
                        <div className="flex gap-1 items-center h-4">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Quick questions */}
            {showQuickButtons && !initError && (
              <div className="px-3 pb-2 pt-1 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <p className="text-xs text-slate-400 mb-2">Vanlige spørsmål:</p>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuick(q.query)}
                      className="text-xs px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Spør om en funksjon i appen..."
                  disabled={loading || !conversation}
                  className="flex-1 text-sm h-8"
                />
                <Button
                  onClick={() => sendMessage()}
                  disabled={loading || !conversation || !input.trim()}
                  size="icon"
                  className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 text-center">
                🔒 Ingen persondata lagres · Kun app-relaterte spørsmål
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}