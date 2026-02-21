import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { useTheme } from '@/components/shared/ThemeContext';

/**
 * A mobile-friendly Select that uses a BottomSheet on small screens
 * and falls back to a standard <select> feel via the BottomSheet picker.
 *
 * Props mirror a simplified shadcn Select:
 *   value, onValueChange, options: [{value, label}], placeholder, className
 */
export default function NativeSelect({ value, onValueChange, options = [], placeholder = 'Velg...', className = '', title }) {
  const [open, setOpen] = useState(false);
  const { darkMode } = useTheme();

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center justify-between w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring ${className}`}
      >
        <span className={value ? '' : 'text-muted-foreground'}>{selectedLabel}</span>
        <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={title || placeholder}>
        <div className="space-y-1 pb-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onValueChange(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-colors ${
                opt.value === value
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : darkMode
                  ? 'text-slate-200 hover:bg-slate-800 active:bg-slate-700'
                  : 'text-slate-800 hover:bg-slate-100 active:bg-slate-200'
              }`}
            >
              {opt.label}
              {opt.value === value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}