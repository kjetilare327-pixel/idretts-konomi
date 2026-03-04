// iOS Safari/WebView polyfill
if (typeof window !== 'undefined' && typeof window.Notification === 'undefined') {
  try { window.Notification = undefined; } catch(e) {}
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { TeamProvider, useTeam } from './components/shared/TeamContext';
import { ThemeProvider, useTheme } from './components/shared/ThemeContext';
import { base44 } from '@/api/base44Client';
import ErrorBoundary from './components/shared/ErrorBoundary';
import {
  LayoutDashboard, Receipt, PiggyBank, FileBarChart, Settings, Menu, X,
  Sun, Moon, ChevronDown, ChevronRight, Shield, Users, ScrollText,
  Mail, Sparkles, ArrowLeft, LogOut,
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
import JoinActivationScreen from './components/shared/JoinActivationScreen';

// ─── Module-level session cache (survives page navigations) ──────────────────
// { bootData, lastFetch: timestamp }  — cleared on logout or explicit invalidate
let _sessionCache = null;

export function invalidateSessionCache() {
  _sessionCache = null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Pages that render standalone (no auth gate, no sidebar)
const NO_LAYOUT_PAGES = new Set(['Onboarding', 'GdprConsent', 'TermsOfService']);
const ROOT_PAGES = ['Dashboard', 'PaymentPortal', 'Players', 'Reports', 'SettingsPage'];

// ─── Navigation config ────────────────────────────────────────────────────────
// ROLES MATRIX:
// ADMIN tier: admin, kasserer, styreleder, revisor — full access to finance/team data
// MEMBER tier: player, forelder — own payments, own profile, events only
//   Members CANNOT see: Transaksjoner, Bankavstemming, Budsjett, Rapporter, Fakturering, Kommunikasjon, Revisjonslogg
const CORE_NAV = [
  { name: 'Dashboard',       page: 'Dashboard',           icon: LayoutDashboard, roles: ['admin','kasserer','styreleder','revisor','player','forelder'] },
  { name: 'Mine betalinger', page: 'PaymentPortal',       icon: Receipt,         roles: ['player','forelder'] },
  { name: 'Spillere',        page: 'Players',             icon: Users,           roles: ['admin','kasserer','styreleder','revisor','player','forelder'] },
  { name: 'Transaksjoner',   page: 'Transactions',        icon: Receipt,         roles: ['admin','kasserer','revisor','player','forelder'] },
  { name: 'Bankavstemming',  page: 'BankReconciliation',  icon: Receipt,         roles: ['admin','kasserer','player','forelder'] },
  { name: 'Budsjett',        page: 'Budget',              icon: PiggyBank,       roles: ['admin','kasserer','styreleder','revisor','player','forelder'] },
  { name: 'Fakturering',     page: 'InvoiceAutomation',   icon: Receipt,         roles: ['admin','kasserer','player','forelder'] },
  { name: 'Rapporter',       page: 'Reports',             icon: FileBarChart,    roles: ['admin','kasserer','styreleder','revisor','player','forelder'] },
  { name: 'Kommunikasjon',   page: 'Communications',      icon: Mail,            roles: ['admin','kasserer'] },
  { name: 'Revisjonslogg',   page: 'AuditLog',            icon: ScrollText,      roles: ['admin','styreleder','revisor'] },
  { name: 'Innstillinger',   page: 'SettingsPage',        icon: Settings,        roles: ['admin','kasserer','styreleder'] },
];

const ADVANCED_NAV = [
  { name: 'Regnskap', page: 'AccountingIntegration', icon: FileBarChart, roles: ['admin','kasserer'] },
];

// ─── Shared UI ────────────────────────────────────────────────────────────────
function FullScreenLoader({ timedOut, onRetry }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <Shield style={{ width: 28, height: 28, color: '#fff' }} />
      </div>
      {timedOut ? (
        <>
          <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: 16 }}>Tilkoblingen tok for lang tid.</p>
          <button
            onClick={() => { invalidateSessionCache(); window.location.reload(); }}
            style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, cursor: 'pointer' }}
          >
            Prøv igjen
          </button>
        </>
      ) : (
        <>
          <div style={{ width: 32, height: 32, border: '3px solid #d1fae5', borderTopColor: '#059669', borderRadius: '50%', animation: '_spin 0.8s linear infinite', marginBottom: 16 }} />
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Laster inn…</p>
        </>
      )}
    </div>
  );
}

function NavLink({ item, active, darkMode, onClick }) {
  return (
    <Link
      to={createPageUrl(item.page)}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation min-h-[44px] ${
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

// ─── AppLayout ────────────────────────────────────────────────────────────────
function AppLayout({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const { currentTeam, teams, selectTeam, user, currentTeamRole } = useTeam();
  const { darkMode, toggleDark } = useTheme();
  const navigate = useNavigate();
  const isChildRoute = !ROOT_PAGES.includes(currentPageName);
  const userRole = currentTeamRole || 'player';
  const activeAdvanced = ADVANCED_NAV.some(i => i.page === currentPageName);

  const toggleSidebar = () => {
    setSidebarCollapsed(v => {
      const next = !v;
      try { localStorage.setItem('sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  };

  const handleLogout = () => {
    invalidateSessionCache();
    base44.auth.logout();
  };

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
      <aside className={`hidden lg:flex flex-col border-r ${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-200 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} fixed h-screen z-30`}>
        <div className={`border-b border-inherit flex-shrink-0 ${sidebarCollapsed ? 'p-3' : 'p-6'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <h1 className="font-bold text-lg leading-tight tracking-tight">IdrettsØkonomi</h1>
                  <p className="text-xs text-slate-500">Økonomistyring</p>
                </div>
              )}
            </div>
            <button
              onClick={toggleSidebar}
              className={`shrink-0 p-1 rounded-lg ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
              title={sidebarCollapsed ? 'Utvid meny' : 'Minimer meny'}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>

        {!sidebarCollapsed && teams.length > 0 && (
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

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto min-h-0">
          {CORE_NAV.filter(item => item.roles.includes(userRole)).map(item => (
            sidebarCollapsed ? (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                title={item.name}
                className={`flex items-center justify-center p-2.5 rounded-lg transition-all min-h-[44px] ${
                  currentPageName === item.page
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
              </Link>
            ) : (
              <NavLink key={item.page} item={item} active={currentPageName === item.page} darkMode={darkMode} />
            )
          ))}
          {!sidebarCollapsed && ADVANCED_NAV.some(i => i.roles.includes(userRole)) && (
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

        <div className={`border-t border-inherit space-y-2 flex-shrink-0 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
          {!sidebarCollapsed && (
            <>
              <div className="px-3 py-2"><PushNotifications /></div>
              <div className="px-3 py-2"><NotificationCenter userEmail={user?.email} teamId={currentTeam?.id} /></div>
            </>
          )}
          <button onClick={toggleDark} className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm min-h-[44px] ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`} title={darkMode ? 'Lyst tema' : 'Mørkt tema'}>
            {darkMode ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!sidebarCollapsed && (darkMode ? 'Lyst tema' : 'Mørkt tema')}
          </button>
        </div>
        {/* Drag resize handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-emerald-400/40 transition-colors z-50"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = sidebarCollapsed ? 64 : 256;
            const onMove = (ev) => {
              const newW = Math.max(64, Math.min(320, startWidth + ev.clientX - startX));
              if (newW < 100) {
                setSidebarCollapsed(true);
                try { localStorage.setItem('sidebar_collapsed', 'true'); } catch {}
              } else {
                setSidebarCollapsed(false);
                try { localStorage.setItem('sidebar_collapsed', 'false'); } catch {}
              }
            };
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        />

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
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <main className={`flex-1 min-h-0 overflow-y-auto transition-all duration-200 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`} style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentPageName}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
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

// ─── AuthGate ─────────────────────────────────────────────────────────────────
//
// Flow:
//   1. Check module-level cache (fresh < 5 min) → skip boot, render immediately
//   2. If not cached: check auth → if not authed, redirect to login
//   3. If pending_joined_team_id exists → show JoinActivationScreen (retry loop, no Onboarding bounce)
//   4. If authed with teams → render app
//   5. If no teams → Onboarding
//
function AuthGate({ children, currentPageName }) {
  // status: 'loading' | 'join_activation' | 'no_team' | 'authed'
  const [status, setStatus]       = useState('loading');
  const [bootData, setBootData]   = useState(null);
  const [timedOut, setTimedOut]   = useState(false);
  const [pendingUser, setPendingUser]         = useState(null);
  const [pendingTeamId, setPendingTeamId]     = useState(null);
  const [pendingTeamName, setPendingTeamName] = useState(null);
  const bootingRef = useRef(false);

  const boot = useCallback(async () => {
    if (bootingRef.current) return;
    bootingRef.current = true;

    try {
      const authenticated = await base44.auth.isAuthenticated().catch(() => false);
      if (!authenticated) { window.location.replace('/login'); return; }

      const user = await base44.auth.me().catch(() => null);
      if (!user) { window.location.replace('/login'); return; }

      const userEmail = user.email.toLowerCase();

      // ?is_new_user=true → always Onboarding
      if (new URLSearchParams(window.location.search).get('is_new_user') === 'true') {
        setStatus('no_team');
        bootingRef.current = false;
        return;
      }

      // Check for pending join BEFORE clearing localStorage
      const storedPendingId   = (() => { try { return localStorage.getItem('pending_joined_team_id'); } catch { return null; } })();
      const storedPendingName = (() => { try { return localStorage.getItem('pending_joined_team_name'); } catch { return null; } })();

      if (storedPendingId) {
        setPendingUser(user);
        setPendingTeamId(storedPendingId);
        setPendingTeamName(storedPendingName);
        setStatus('join_activation');
        bootingRef.current = false;
        return;
      }

      // Clear stale team selection
      try { localStorage.removeItem('idrettsøkonomi_team_id'); } catch {}

      const [createdTeams, memberRecords] = await Promise.all([
        base44.entities.Team.filter({ created_by: user.email }).catch(() => []),
        base44.entities.TeamMember.filter({ user_email: userEmail }).catch(() => []),
      ]);

      // Auto-accept pending invites
      const pendingInvites = memberRecords.filter(m => m.status === 'invited');
      if (pendingInvites.length > 0) {
        await base44.functions.invoke('acceptPendingInvites', { user_email: userEmail }).catch(() => {});
        const refreshed = await base44.entities.TeamMember.filter({ user_email: userEmail }).catch(() => []);
        if (refreshed.length > 0) {
          memberRecords.length = 0;
          refreshed.forEach(r => memberRecords.push(r));
        }
      }

      const byId = new Map();
      for (const t of createdTeams) byId.set(t.id, t);

      const missingIds = memberRecords.map(m => m.team_id).filter(id => id && !byId.has(id));
      if (missingIds.length > 0) {
        const fetched = await Promise.all(missingIds.map(id => base44.entities.Team.filter({ id }).catch(() => [])));
        for (const arr of fetched) for (const t of arr) byId.set(t.id, t);
        if ([...byId.values()].length < memberRecords.length) {
          const allTeams = await base44.entities.Team.list().catch(() => []);
          for (const t of allTeams) { if (missingIds.includes(t.id)) byId.set(t.id, t); }
        }
      }

      const activeMemberships = memberRecords.filter(m => m.status === 'active');
      const hasAccess = activeMemberships.length > 0 || createdTeams.length > 0;

      if (!hasAccess) {
        setStatus('no_team');
        bootingRef.current = false;
        return;
      }

      const ROLE_PRIORITY_BOOT = ['admin', 'kasserer', 'styreleder', 'revisor', 'forelder', 'player'];
      const deduped = {};
      for (const m of activeMemberships) {
        const existing = deduped[m.team_id];
        if (!existing || ROLE_PRIORITY_BOOT.indexOf(m.role) < ROLE_PRIORITY_BOOT.indexOf(existing.role)) {
          deduped[m.team_id] = m;
        }
      }

      const data = { user, teams: [...byId.values()], memberTeams: Object.values(deduped) };
      _sessionCache = { bootData: data, lastFetch: Date.now() };
      setBootData(data);
      setStatus('authed');
    } catch (err) {
      console.error('[AuthGate] boot error:', err?.message);
      _sessionCache = null;
      setTimedOut(true);
    } finally {
      bootingRef.current = false;
    }
  }, []);

  useEffect(() => { boot(); }, [boot]);

  useEffect(() => {
    if (status !== 'loading') return;
    const id = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(id);
  }, [status]);

  const retry = () => {
    invalidateSessionCache();
    bootingRef.current = false;
    setStatus('loading');
    setTimedOut(false);
    boot();
  };

  // No team → render Onboarding inline (no redirect loop)
  if (status === 'no_team') {
    const OnboardingPage = React.lazy(() => import('./pages/Onboarding'));
    return (
      <React.Suspense fallback={<FullScreenLoader />}>
        <OnboardingPage />
      </React.Suspense>
    );
  }

  if (status === 'join_activation') {
    return (
      <JoinActivationScreen
        teamId={pendingTeamId}
        teamName={pendingTeamName}
        user={pendingUser}
        onSuccess={(resolvedBootData) => {
          _sessionCache = { bootData: resolvedBootData, lastFetch: Date.now() };
          setBootData(resolvedBootData);
          setStatus('authed');
        }}
        onAbort={() => setStatus('no_team')}
      />
    );
  }

  if (status !== 'authed') {
    return <FullScreenLoader timedOut={timedOut} onRetry={retry} />;
  }

  return (
    <TeamProvider bootData={bootData}>
      <AppLayout currentPageName={currentPageName}>{children}</AppLayout>
    </TeamProvider>
  );
}

// ─── Root layout export ───────────────────────────────────────────────────────
export default function Layout({ children, currentPageName }) {
  const urlPage = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('page')
    : null;
  const effectivePage = urlPage || currentPageName || '';

  // Standalone pages — no auth, no sidebar
  if (NO_LAYOUT_PAGES.has(effectivePage)) {
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