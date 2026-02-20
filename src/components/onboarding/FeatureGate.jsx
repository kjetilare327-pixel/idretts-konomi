import React from 'react';
import { Lock } from 'lucide-react';

/**
 * Wraps advanced features that should be hidden until core setup (steps 1–3) is done.
 * coreSetupDone: boolean – derived from isCoreSetupDone(completedSteps)
 */
export default function FeatureGate({ coreSetupDone, children, label = 'Avansert funksjon' }) {
  if (coreSetupDone) return <>{children}</>;

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px] rounded-xl">
        <Lock className="w-5 h-5 text-slate-500 mb-1" />
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 text-center px-4">
          Fullfør oppsett (steg 1–3) for å låse opp {label}
        </p>
      </div>
    </div>
  );
}