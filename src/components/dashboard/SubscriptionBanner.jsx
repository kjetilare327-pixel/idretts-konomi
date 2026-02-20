import React from 'react';
import { differenceInDays } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SubscriptionBanner({ team }) {
  if (!team) return null;

  const status = team.subscription_status || 'trial';
  const trialEnd = team.trial_end_date ? new Date(team.trial_end_date) : null;
  const daysLeft = trialEnd ? differenceInDays(trialEnd, new Date()) : 0;

  const configs = {
    active: {
      icon: CheckCircle,
      bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
      text: 'text-emerald-800 dark:text-emerald-300',
      label: 'Aktivt abonnement',
      desc: 'Alt fungerer som det skal.'
    },
    trial: {
      icon: Clock,
      bg: daysLeft <= 3
        ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
        : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
      text: daysLeft <= 3 ? 'text-amber-800 dark:text-amber-300' : 'text-blue-800 dark:text-blue-300',
      label: `Prøveperiode – ${Math.max(daysLeft, 0)} dager igjen`,
      desc: daysLeft <= 3 ? 'Prøveperioden din utløper snart.' : '14-dagers gratis prøveperiode aktiv.'
    },
    expired: {
      icon: XCircle,
      bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
      text: 'text-red-800 dark:text-red-300',
      label: 'Abonnement utløpt',
      desc: 'Oppgrader for å fortsette å bruke alle funksjoner.'
    },
    cancelled: {
      icon: AlertTriangle,
      bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
      text: 'text-slate-800 dark:text-slate-300',
      label: 'Abonnement kansellert',
      desc: 'Du har fortsatt tilgang til perioden utløper.'
    }
  };

  const config = configs[status] || configs.trial;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border ${config.bg} ${config.text}`}>
      <Icon className="w-5 h-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{config.label}</p>
        <p className="text-xs opacity-80">{config.desc}</p>
      </div>
      {(status === 'trial' || status === 'expired') && (
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
          Oppgrader – 99 kr/mnd
        </Button>
      )}
    </div>
  );
}