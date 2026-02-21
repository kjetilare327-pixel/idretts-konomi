import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { TeamProvider, useTeam } from './components/shared/TeamContext';
import { ThemeProvider, useTheme } from './components/shared/ThemeContext';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  FileBarChart,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  LogOut,
  Shield,
  Users,
  ScrollText,
  Mail,
  Building2,
  Sparkles,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationCenter from './components/notifications/NotificationCenter';
import SupportChatbot from './components/support/SupportChatbot';
import OfflineManager from './components/mobile/OfflineManager';
import PushNotifications from './components/mobile/PushNotifications';
import BottomNav from './components/mobile/BottomNav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// Core nav items
const CORE_NAV = [
  { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'kasserer', 'styreleder', 'revisor', 'player', 'parent'] },
  { name: 'Mine betalinger', page: 'PaymentPortal', icon: Receipt, roles: ['player', 'parent'] },
  { name: 'Spillere', page: 'Players', icon: Users, roles: ['admin', 'kasserer', 'styreleder', 'revisor'] },
  { name: 'Transaksjoner', page: 'Transactions', icon: Receipt, roles: ['admin', 'kasserer', 'revisor'] },
  { name: 'Bankavstemming', page: 'BankReconciliation', icon: Receipt, roles: ['admin', 'kasserer'] },
  { name: 'Budsjett', page: 'Budget', icon: PiggyBank, roles: ['admin', 'kasserer', 'revisor'] },
  { name: 'Fakturering', page: 'InvoiceAutomation', icon: Receipt, roles: ['admin', 'kasserer'] },
  { name: 'Rapporter', page: 'Reports', icon: FileBarChart, roles: ['admin', 'kasserer', 'styreleder', 'revisor'] },
  { name: 'Kommunikasjon', page: 'Communications', icon: Mail, roles: ['admin', 'kasserer'] },
  { name: 'Revisjonslogg', page: 'AuditLog', icon: ScrollText, roles: ['admin', 'styreleder', 'revisor'] },
  { name: 'Innstillinger', page: 'SettingsPage', icon: Settings, roles: ['admin', 'kasserer', 'styreleder'] },
];

// Advanced (Pro) nav items – shown in collapsible section
const ADVANCED_NAV = [
  { name: 'Avanserte analyser', page: 'AdvancedAnalytics', icon: FileBarChart, roles: ['admin', 'kasserer', 'styreleder'] },
  { name: 'Sponsorer', page: 'Sponsors', icon: Building2, roles: ['admin', 'kasserer', 'styreleder'] },
  { name: 'Regnskap', page: 'AccountingIntegration', icon: FileBarChart, roles: ['admin', 'kasserer'] },
];

function NavLink({ item, active, darkMode, onClick }) {
  return (
    <Link
      to={createPageUrl(item.page)}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation ${
        active
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
          : darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      <item.icon className="w-5 h-5 shrink-0" />
      {item.name}
    </Link>
  );
}

function InnerLayout({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { currentTeam, teams, selectTeam, user, isTeamAdmin } = useTeam();
  const { darkMode, toggleDark } = useTheme();
  const isAdmin = isTeamAdmin();
  
  const getUserRole = () => {
    if (!currentTeam || !user) return 'player';
    const member = currentTeam.members?.find(m => m.email === user.email);
    return member?.role || 'player';
  };
  
  const userRole = getUserRole();
  const activeAdvanced = ADVANCED_NAV.some(i => i.page === currentPageName);

  const noLayoutPages = ['Onboarding', 'GdprConsent'];
  if (noLayoutPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  return (
    <div className={`h-screen flex overflow-hidden ${darkMode ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <style>{`
        :root {
          --brand: #10b981;
          --brand-dark: #059669;
          --danger: #ef4444;
          --warning: #f59e0b;
        }
        .dark { --bg-card: #1e293b; --bg-surface: #0f172a; --text-muted: #94a3b8; }
        :not(.dark) { --bg-card: #ffffff; --bg-surface: #f8fafc; --text-muted: #64748b; }

        /* Mobile-first touch optimizations */
        @media (max-width: 768px) {
          * {
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
          }

          button, a {
            min-height: 44px;
            min-width: 44px;
          }
        }

        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>

      <OfflineManager />

      {/* Sidebar – desktop */}
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

        {/* Team selector */}
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
                  <DropdownMenuItem key={t.id} onClick={() => selectTeam(t)}>
                    {t.name}
                  </DropdownMenuItem>
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
          {CORE_NAV.filter(item => !item.roles || item.roles.includes(userRole)).map(item => (
            <NavLink key={item.page} item={item} active={currentPageName === item.page} darkMode={darkMode} />
          ))}

          {/* Advanced / Pro section */}
          {ADVANCED_NAV.some(i => !i.roles || i.roles.includes(userRole)) && (
            <div className="pt-2">
              <button
                onClick={() => setAdvancedOpen(o => !o)}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  activeAdvanced
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Avansert

                <ChevronRight className={`w-3.5 h-3.5 ml-auto transition-transform ${advancedOpen || activeAdvanced ? 'rotate-90' : ''}`} />
              </button>
              {(advancedOpen || activeAdvanced) && (
                <div className="mt-1 space-y-1 pl-2 border-l-2 border-slate-100 dark:border-slate-800 ml-2">
                  {ADVANCED_NAV.filter(item => !item.roles || item.roles.includes(userRole)).map(item => (
                    <NavLink key={item.page} item={item} active={currentPageName === item.page} darkMode={darkMode} />
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-inherit space-y-2 flex-shrink-0">
          <div className="px-3 py-2">
            <PushNotifications />
          </div>
          <div className="px-3 py-2">
            <NotificationCenter userEmail={user?.email} teamId={currentTeam?.id} />
          </div>
          <button onClick={toggleDark} className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? 'Lyst tema' : 'Mørkt tema'}
          </button>
          <button onClick={() => base44.auth.logout()} className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
            <LogOut className="w-4 h-4" />
            Logg ut
          </button>
        </div>
      </aside>

      {/* Mobile header */}
              <div className="lg:hidden fixed top-0 left-0 right-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm">IdrettsØkonomi</span>
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
                    className={`block w-full text-left px-3 py-1.5 rounded text-sm ${currentTeam?.id === t.id ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : ''}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            {CORE_NAV.filter(item => !item.roles || item.roles.includes(userRole)).map(item => (
              <NavLink key={item.page} item={item} active={currentPageName === item.page} darkMode={darkMode} onClick={() => setMobileOpen(false)} />
            ))}
            {ADVANCED_NAV.some(i => !i.roles || i.roles.includes(userRole)) && (
              <>
                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Avansert
                </p>
                {ADVANCED_NAV.filter(item => !item.roles || item.roles.includes(userRole)).map(item => (
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
      <main className="flex-1 lg:ml-64 min-h-0 overflow-y-auto pt-14 lg:pt-0">
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

      {/* Bottom nav – mobile only */}
      <BottomNav currentPageName={currentPageName} />

      {/* Support chatbot */}
      {currentTeam && <SupportChatbot teamId={currentTeam.id} />}
      </div>
      );
      }

      export default function Layout({ children, currentPageName }) {
      return (
      <ThemeProvider>
      <TeamProvider>
        <InnerLayout currentPageName={currentPageName}>{children}</InnerLayout>
      </TeamProvider>
      </ThemeProvider>
      );
      }