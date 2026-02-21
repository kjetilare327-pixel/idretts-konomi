import React, { useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutDashboard, Receipt, Users, FileBarChart, Settings } from 'lucide-react';
import { useTheme } from '@/components/shared/ThemeContext';

const NAV_ITEMS = [
  { label: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
  { label: 'Betalinger', page: 'PaymentPortal', icon: Receipt },
  { label: 'Spillere', page: 'Players', icon: Users },
  { label: 'Rapporter', page: 'Reports', icon: FileBarChart },
  { label: 'Innstillinger', page: 'SettingsPage', icon: Settings },
];

// Map a pathname back to its root tab page name
function getTabForPath(pathname) {
  for (const item of NAV_ITEMS) {
    const url = createPageUrl(item.page);
    if (pathname === url || pathname.startsWith(url + '?') || pathname.startsWith(url + '/')) {
      return item.page;
    }
  }
  return null;
}

export default function BottomNav({ currentPageName }) {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Per-tab last-visited URL memory
  const tabHistory = useRef({});

  // Keep tab history updated with the current path
  const activeTab = getTabForPath(location.pathname) || currentPageName;
  tabHistory.current[activeTab] = location.pathname + location.search;

  const handleNavClick = (e, item) => {
    e.preventDefault();
    if (currentPageName === item.page) {
      // Already on this tab root — scroll to top
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Navigate to remembered URL for this tab, or its root
    const dest = tabHistory.current[item.page] || createPageUrl(item.page);
    navigate(dest);
  };

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex items-stretch ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      {NAV_ITEMS.map(item => {
        const active = currentPageName === item.page;
        return (
          <button
            key={item.page}
            onClick={(e) => handleNavClick(e, item)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
              active
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-500'
            }`}
          >
            <item.icon className={`w-5 h-5 ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}