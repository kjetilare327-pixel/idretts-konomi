import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Users, Search, CheckSquare, Square } from 'lucide-react';

const GROUPS = [
  { id: 'all', label: 'Alle spillere', filter: () => true },
];

export default function PlayerPickerModal({ open, onClose, players = [], onConfirm }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());

  const filtered = useMemo(() =>
    players.filter(p =>
      p.full_name.toLowerCase().includes(search.toLowerCase())
    ), [players, search]);

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroup = (filterFn) => {
    const groupIds = players.filter(filterFn).map(p => p.id);
    const allIn = groupIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      groupIds.forEach(id => allIn ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggleFiltered = () => {
    const ids = filtered.map(p => p.id);
    const allIn = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => allIn ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleConfirm = () => {
    const chosen = players.filter(p => selected.has(p.id));
    onConfirm(chosen);
    onClose();
    setSearch('');
  };

  const handleClose = () => {
    onClose();
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-600" />
            Velg deltakere
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Quick groups */}
          <div className="flex flex-wrap gap-2">
            {GROUPS.map(g => {
              const count = players.filter(g.filter).length;
              const allIn = players.filter(g.filter).every(p => selected.has(p.id));
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGroup(g.filter)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                    allIn
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-400 dark:hover:bg-violet-500/10'
                  }`}
                >
                  {g.label}
                  <Badge className={`text-xs px-1.5 py-0 h-4 ${allIn ? 'bg-violet-500' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'}`}>
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Søk på navn..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Select all filtered */}
          {filtered.length > 0 && (
            <button
              onClick={toggleFiltered}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              {allSelected
                ? <CheckSquare className="w-3.5 h-3.5 text-violet-600" />
                : <Square className="w-3.5 h-3.5" />}
              {allSelected ? 'Fjern alle' : `Velg alle (${filtered.length})`}
            </button>
          )}

          {/* Player list */}
          <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
            {filtered.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Ingen spillere funnet</p>
            )}
            {filtered.map(p => (
              <label
                key={p.id}
                className="flex items-center gap-2.5 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                />
                <span className="text-sm font-medium">{p.full_name}</span>
                {p.role === 'parent' && (
                  <Badge variant="outline" className="text-xs ml-auto">Forelder</Badge>
                )}
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500">{selected.size} valgt</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>Avbryt</Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className="bg-violet-600 hover:bg-violet-700"
              >
                Legg til i tekst ({selected.size})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}