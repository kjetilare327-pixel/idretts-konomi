import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Repeat } from 'lucide-react';

export default function RecurringEventForm({ form, setForm }) {
  return (
    <div className="space-y-4 p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
      <div className="flex items-center gap-2">
        <Checkbox
          id="is_recurring"
          checked={form.is_recurring || false}
          onCheckedChange={(checked) => setForm({ ...form, is_recurring: checked })}
        />
        <Label htmlFor="is_recurring" className="flex items-center gap-2 cursor-pointer">
          <Repeat className="w-4 h-4" />
          Gjenta arrangement
        </Label>
      </div>

      {form.is_recurring && (
        <div className="space-y-3 pl-6 border-l-2 border-indigo-200 dark:border-indigo-800">
          <div className="space-y-2">
            <Label>Hvor ofte</Label>
            <Select
              value={form.recurrence_pattern || 'weekly'}
              onValueChange={(v) => setForm({ ...form, recurrence_pattern: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daglig</SelectItem>
                <SelectItem value="weekly">Ukentlig</SelectItem>
                <SelectItem value="biweekly">Annenhver uke</SelectItem>
                <SelectItem value="monthly">Månedlig</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Gjenta til</Label>
            <Input
              type="date"
              value={form.recurrence_end_date || ''}
              onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })}
            />
            <p className="text-xs text-slate-500">
              Arrangementet vil bli opprettet automatisk til denne datoen
            </p>
          </div>
        </div>
      )}
    </div>
  );
}