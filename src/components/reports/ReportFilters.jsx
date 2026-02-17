import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, Filter } from 'lucide-react';

export default function ReportFilters({ filters, setFilters, categories }) {
  const presetRanges = {
    'this_month': () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    },
    'last_month': () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start, end };
    },
    'this_quarter': () => {
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      return { start, end };
    },
    'this_year': () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start, end };
    },
    'last_year': () => {
      const now = new Date();
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      return { start, end };
    }
  };

  const applyPreset = (preset) => {
    const { start, end } = presetRanges[preset]();
    setFilters({
      ...filters,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Quick presets */}
          <div className="space-y-2">
            <Label>Hurtigvalg</Label>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('this_month')}
                className="justify-start"
              >
                Denne måneden
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('last_month')}
                className="justify-start"
              >
                Forrige måned
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('this_quarter')}
                className="justify-start"
              >
                Dette kvartalet
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('this_year')}
                className="justify-start"
              >
                Dette året
              </Button>
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <Label>Fra dato</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Til dato</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>

          {/* Aggregation */}
          <div className="space-y-2">
            <Label>Grupper etter</Label>
            <Select
              value={filters.groupBy}
              onValueChange={(v) => setFilters({ ...filters, groupBy: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ingen gruppering</SelectItem>
                <SelectItem value="category">Kategori</SelectItem>
                <SelectItem value="month">Måned</SelectItem>
                <SelectItem value="player">Spiller</SelectItem>
                <SelectItem value="type">Type (inntekt/utgift)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <Label>Filtrer kategori</Label>
              <Select
                value={filters.category || 'all'}
                onValueChange={(v) => setFilters({ ...filters, category: v === 'all' ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle kategorier</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}