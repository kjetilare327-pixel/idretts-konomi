import React from 'react';
import { Lock } from 'lucide-react';

export default function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
      <Lock className="w-4 h-4 shrink-0" />
      <span>Du ser en oversikt-visning. Kun administrator kan gjøre endringer.</span>
    </div>
  );
}