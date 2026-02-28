// iOS Safari/WebView polyfill: prevent ReferenceError on bare `Notification` identifier
if (typeof window !== 'undefined' && typeof window.Notification === 'undefined') {
  try { window.Notification = undefined; } catch(e) {}
}

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { TeamProvider, useTeam } from './components/shared/TeamContext';
import { ThemeProvider, useTheme } from './components/shared/ThemeContext';
import { base44 } from '@/api/base44Client';
import ErrorBoundary from './components/shared/ErrorBoundary';
import {
  LayoutDashboard, Receipt, PiggyBank, FileBarChart, Settings, Menu, X,
  Sun, Moon, ChevronDown, ChevronRight, LogOut, Shield, Users, ScrollText,
  Mail, Sparkles, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationCenter from './components/notifications/NotificationCenter';
import SupportChatbot from './components/support/SupportChatbot';
import OfflineManager from './components/mobile/OfflineManager';
import PushNotifications from './components/mobile/PushNotifications';
import BottomNav from './components/mobile/BottomNav';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// ─── Pages that render WITHOUT AuthGate or sidebar ───────────────────────────
// These pages handle their own auth/redirects internally.
const NO_LAYOUT_PAGES = ['Onboarding', 'GdprConsent', 'TermsOfService'];

// ─── Navigation ──────────────────────────────────────────────────────────────
const CORE_NAV = [
  { name: 'Dashboard',       page: 'Dashboard',           icon: LayoutDashboard, roles: ['admin','kasserer','styreleder','revisor','player','forelder'] },
  { name: 'Mine betalinger', page: 'PaymentPortal',       icon: Receipt,         roles: ['player','forelder'] },
  { name: 'Spillere',        page: 'Players',             icon: Users,           roles: ['admin','kasserer','styreleder','revisor'] },
  { name: 'Transaksjoner',   page: 'Transactions',        icon: Receipt,         roles: ['admin','kasserer','revisor'] },
  { name: 'Bankavstemming',  page: 'BankReconciliation',  icon: Receipt,         roles: ['admin','kasserer'] },
  { name: 'Budsjett',        page: 'Budget',              icon: PiggyBank,       roles: ['admin','kasserer','revisor'] },
  { name: 'Fakturering',     page: 'InvoiceAutomation',   icon: Receipt,         roles: ['admin','kasserer'] },
  { name: 'Rapporter',       page: 'Reports',             icon: FileBarChart,    roles: ['admin','kasserer','styreleder','revisor'] },
  { name: 'Kommunikasjon',   page: 'Communications',      icon: Mail,            roles: ['admin','kasserer'] },
  { name: 'Revisjonslogg',   page: 'AuditLog',            icon: ScrollText,      roles: ['admin','styreleder','revisor'] },
  { name: 'Innstillinger',   page: 'SettingsPage',        icon: Settings,        roles: ['admin','kasserer','styreleder'] },
];

const ADVANCED_NAV = [
  { name: 'Regnskap', page: 'AccountingIntegration', icon: FileBarChart, roles: ['admin','kasserer'] },
];

const ROOT_PAGES = ['Dashboard','PaymentPortal','Players','Reports','SettingsPage','Onboarding'];

// ─── NavLink ─────────────────────────────────────────────────────────────────
function NavLink({ item, active, darkMode, onClick }) {
  return (
    <Link
      to={createPageUrl(item.page)}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation ${
        active
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
          : darkMode
            ? 'text-slate-400 hover:text-white hover:bg-slate-800'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      <item.icon className="w-5 h-5 shrink-0" />
      {item.name}
    </Link>
  );
}

// ─── InnerLayout (requires TeamProvider context) ──────────────────────────────
function InnerLayout({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { currentTeam, teams, selectTeam, user, currentTeamRole } = useTeam();
  const { darkMode, toggleDark } = useTheme();
  const navigate = useNavigate();
  const isChildRoute = !ROOT_PAGES.includes(currentPageName);
  const userRole = currentTeamRole || 'player';
  const activeAdvanced = ADVANCED_NAV.some(i => i.page === currentPageName);

  return (
    <div className={`h-screen flex overflow-hidden ${darkMode ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <style>{`
        :root { --brand: #10b981; --brand-dark: #059669; }
        .dark { --bg-card: #1e293b; --bg-surface: #0f172a; }
        :not(.dark) { --bg-card: #ffffff; --bg-surface: #f8fafc; }
        @media (max-width: 768px) {
          * { -webkit-tap-highlight-color: transparent; }
          button, a { min-height: 44px; min-width: 44px; }
        }
        html { scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <OfflineManager />

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col w-64 border-r ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} fixed h-screen z-30`}>
        <div className="p-6 border-b border-inherit flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight">IdrettsØkonomi</h1>
              <p className="text-xs text-slate-500">Økonomistyring</p>
            </div>
          </div>
        </div>

        {teams.length > 0 && (
          <div className="px-4 py-3 border-b border-inherit flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-left font-medium text-sm h-auto py-2">
                  <span className="truncate">{currentTeam?.name || 'Velg lag'}</span>
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {teams.map(t => (
                  <DropdownMenuItem key={t.id} onClick={() => selectTeam(t)}>{t.name}</DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl('Onboarding')}>+ Opprett nytt lag</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto min-h-0">
          {CORE_NAV.filter(item => item.roles.includes(userRole)).map(item => (
            <NavLink key={item.page} item={item} active={currentPageName === item.page} darkMode={darkMode} />
          ))}
          {ADVANCED_NAV.some(i => i.roles.includes(userRole)) && (
            <div className="pt-2">
              <button
                onClick={() => setAdvancedOpen(o => !o)}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  activeAdvanced ? 'text-emerald-600' : darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Avansert
                <ChevronRight className={`w-3.5 h-3.5 ml-auto transition-transform ${advancedOpen || activeAdvanced ? 'rotate-90' : ''}`} />
              </button>
              {(advancedOpen || activeAdvanced) && (
                <div className="mt-1 space-y-1 pl-2 border-l-2 border-slate-100 dark:border-slate-800 ml-2">
                  {ADVANCED_NAV.filter(item => item.roles.includes(userRole)).map(item => (
                    <NavLink key={item.page} item={item} active={currentPageName === item.page} darkMode={darkMode} />
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-inherit space-y-2 flex-shrink-0">
          <div className="px-3 py-2"><PushNotifications /></div>
          <div className="px-3 py-2"><NotificationCenter userEmail={user?.email} teamId={currentTeam?.id} /></div>
          <button onClick={toggleDark} className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? 'Lyst tema' : 'Mørkt tema'}
          </button>
          <button onClick={() => base44.auth.logout()} className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
            <LogOut className="w-4 h-4" /> Logg ut
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            {isChildRoute ? (
              <button onClick={() => navigate(-1)} className={`flex items-center gap-1 text-sm font-medium ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                <ArrowLeft className="w-5 h-5" /> Tilbake
              </button>
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-sm">IdrettsØkonomi</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter userEmail={user?.email} teamId={currentTeam?.id} />
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className={`border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} px-4 py-3 space-y-1 max-h-[calc(100vh-60px)] overflow-y-auto`}>
            {teams.length > 1 && (
              <div className="pb-2 mb-2 border-b border-inherit">
                {teams.map(t => (
                  <button key={t.id} onClick={() => { selectTeam(t); setMobileOpen(false); }}
                    className={`block w-full text-left px-3 py-1.5 rounded text-sm ${currentTeam?.id === t.id ? 'bg-emerald-50 text-emerald-700' : ''}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            {CORE_NAV.filter(item => item.roles.includes(userRole)).map(item => (
              <NavLink key={item.page} item={item} active={currentPageName === item.page} darkMode={darkMode} onClick={() => setMobileOpen(false)} />
            ))}
            {ADVANCED_NAV.some(i => i.roles.includes(userRole)) && (
              <>
                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Avansert
                </p>
                {ADVANCED_NAV.filter(item => item.roles.includes(userRole)).map(item => (
                  <NavLink key={item.page} item={item} active={currentPageName === item.page} darkMode={darkMode} onClick={() => setMobileOpen(false)} />
                ))}
              </>
            )}
            <div className="pt-2 border-t border-inherit flex items-center justify-between">
              <button onClick={toggleDark} className="text-sm flex items-center gap-2 px-3 py-2">
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} {darkMode ? 'Lyst' : 'Mørkt'}
              </button>
              <button onClick={() => base44.auth.logout()} className="text-sm flex items-center gap-2 px-3 py-2 text-red-500">
                <LogOut className="w-4 h-4" /> Logg ut
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <main
        className="flex-1 lg:ml-64 min-h-0 overflow-y-auto"
        style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentPageName}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav currentPageName={currentPageName} />
      {currentTeam && <SupportChatbot teamId={currentTeam.id} />}
    </div>
  );
}

// ─── Boot UI ──────────────────────────────────────────────────────────────────
function BootLoader({ onTimeout }) {
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(id);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Shield style={{ width: 26, height: 26, color: '#fff' }} />
      </div>
      {timedOut ? (
        <>
          <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: 16 }}>Tilkoblingen tok for lang tid.</p>
          <button
            onClick={onTimeout}
            style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Prøv igjen
          </button>
        </>
      ) : (
        <>
          <div style={{ width: 32, height: 32, border: '3px solid #d1fae5', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Laster inn…</p>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function BootError({ message, onRetry }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 8, color: '#1e293b' }}>Innlasting mislyktes</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 24 }}>{message || 'Sjekk internettilkoblingen og prøv igjen.'}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onRetry} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
            Prøv igjen
          </button>
          <button onClick={() => base44.auth.logout()} style={{ background: 'transparent', color: '#059669', border: '1px solid #059669', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
            Logg inn på nytt
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AuthGate boot logic (promise singleton — safe across StrictMode) ─────────
// Only ONE boot sequence runs per page load, no matter how many times
// AuthGate mounts/unmounts (StrictMode, HMR, etc.)
let _bootPromise = null;  // Promise<result> | null
let _bootResult  = null;  // cached resolved result | null

async function runBoot() {
  const t0 = Date.now();
  const page = new URLSearchParams(window.location.search).get('page') || '(root)';
  console.log('[AuthGate] boot start — page=', page);

  // ① Authentication check
  let authenticated = false;
  try { authenticated = await base44.auth.isAuthenticated(); } catch (_) {}
  console.log('[AuthGate] authenticated=', authenticated, `+${Date.now()-t0}ms`);

  if (!authenticated) {
    console.log('[AuthGate] not authenticated → redirecting to login');
    // After login, platform sends back to /?page=Dashboard; AuthGate runs fresh there
    base44.auth.redirectToLogin(window.location.origin + '/?page=Dashboard');
    return { status: 'redirecting' };
  }

  // ② User profile
  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}
  console.log('[AuthGate] user=', user?.email, `+${Date.now()-t0}ms`);

  if (!user) {
    console.log('[AuthGate] no user object → redirecting to login');
    base44.auth.redirectToLogin(window.location.origin + '/?page=Dashboard');
    return { status: 'redirecting' };
  }

  // ③ Teams — parallel fetch, graceful RLS degradation
  const userEmail = user.email.toLowerCase();
  console.log('[AuthGate] fetching teams for', userEmail, '...');

  const [createdTeams, memberRecords] = await Promise.all([
    base44.entities.Team.filter({ created_by: user.email }).catch(() => []),
    base44.entities.TeamMember.filter({ user_email: userEmail }).catch(() => []),
  ]);
  console.log('[AuthGate] createdTeams=', createdTeams.length, 'memberRecords=', memberRecords.length, `+${Date.now()-t0}ms`);

  // Deduplicate by id
  const byId = new Map();
  for (const t of createdTeams) byId.set(t.id, t);

  // Load team objects for any membership records not yet in byId
  const missingIds = memberRecords.map(m => m.team_id).filter(id => id && !byId.has(id));
  if (missingIds.length > 0) {
    console.log('[AuthGate] fetching', missingIds.length, 'extra team objects...');
    const allTeams = await base44.entities.Team.list().catch(() => []);
    for (const t of allTeams) {
      if (missingIds.includes(t.id)) byId.set(t.id, t);
    }
  }

  const hasTeam = byId.size > 0;
  console.log('[AuthGate] hasTeam=', hasTeam, 'total=', byId.size, `+${Date.now()-t0}ms`);

  if (!hasTeam) {
    // Brand-new user — redirect to Onboarding (NO_LAYOUT_PAGES bypasses AuthGate entirely)
    console.log('[AuthGate] no teams → Onboarding');
    window.location.replace('/?page=Onboarding');
    return { status: 'redirecting' };
  }

  const data = { user, teams: [...byId.values()], memberTeams: memberRecords };
  console.log('[AuthGate] ready', `+${Date.now()-t0}ms`);
  return { status: 'ready', data };
}

function getBootPromise() {
  if (!_bootPromise) {
    _bootPromise = runBoot().then(result => {
      _bootResult = result;
      return result;
    }).catch(err => {
      console.error('[AuthGate] boot error:', err?.message);
      _bootPromise = null; // allow retry
      _bootResult = null;
      return { status: 'error', message: err?.message || 'Ukjent feil' };
    });
  }
  return _bootPromise;
}

// ─── AuthGate component ───────────────────────────────────────────────────────
function AuthGate({ children, currentPageName }) {
  // Synchronously initialise from cache if already resolved — avoids any loading flash
  const [phase, setPhase] = React.useState(() =>
    _bootResult?.status === 'ready' ? 'ready' : 'loading'
  );
  const [bootData, setBootData] = React.useState(() =>
    _bootResult?.status === 'ready' ? _bootResult.data : null
  );
  const [errorMsg, setErrorMsg] = React.useState('');

  React.useEffect(() => {
    // Nothing to do if already resolved
    if (phase === 'ready') return;

    // Sync check in case result arrived between render and effect
    if (_bootResult?.status === 'ready') {
      setBootData(_bootResult.data);
      setPhase('ready');
      return;
    }

    let alive = true;

    getBootPromise().then(result => {
      if (!alive) return;
      if (result.status === 'ready') {
        setBootData(result.data);
        setPhase('ready');
      } else if (result.status === 'error') {
        setErrorMsg(result.message || 'Noe gikk galt – prøv igjen.');
        setPhase('error');
      }
      // 'redirecting' → navigation already in progress; keep showing loader
    });

    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    _bootPromise = null;
    _bootResult  = null;
    setBootData(null);
    setErrorMsg('');
    setPhase('loading');
  };

  if (phase === 'loading') return <BootLoader onTimeout={handleRetry} />;
  if (phase === 'error')   return <BootError message={errorMsg} onRetry={handleRetry} />;

  return (
    <TeamProvider bootData={bootData}>
      <InnerLayout currentPageName={currentPageName}>{children}</InnerLayout>
    </TeamProvider>
  );
}

// ─── Root Layout export ───────────────────────────────────────────────────────
export default function Layout({ children, currentPageName }) {
  // Read page name from URL param — more reliable than prop during navigations
  const urlPage = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('page')
    : null;
  const effectivePage = urlPage || currentPageName || '';

  // NO_LAYOUT_PAGES: render bare (no AuthGate, no sidebar)
  if (NO_LAYOUT_PAGES.includes(effectivePage)) {
    return (
      <ErrorBoundary>
        <ThemeProvider>{children}</ThemeProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthGate currentPageName={effectivePage}>{children}</AuthGate>
      </ThemeProvider>
    </ErrorBoundary>
  );
}