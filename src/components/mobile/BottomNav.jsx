import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export default function BottomNav({ currentPageName }) {
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const handleNavClick = (e, item) => {
    if (currentPageName === item.page) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex items-stretch ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map(item => {
        const active = currentPageName === item.page;
        return (
          <Link
            key={item.page}
            to={createPageUrl(item.page)}
            onClick={(e) => handleNavClick(e, item)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
              active
                ? 'text-emerald-600 dark:text-emerald-400'
                : darkMode
                ? 'text-slate-500'
                : 'text-slate-500'
            }`}
          >
            <item.icon className={`w-5 h-5 ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}