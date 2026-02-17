import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function ProfileCompletionPrompt({ player, onComplete, onDismiss }) {
  const [form, setForm] = useState({
    phone: player?.phone || '',
    notes: player?.notes || ''
  });
  const [saving, setSaving] = useState(false);

  const missingFields = [];
  if (!player?.phone) missingFields.push('telefonnummer');
  if (!player?.notes) missingFields.push('ekstra informasjon');

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Player.update(player.id, {
        phone: form.phone,
        notes: form.notes
      });

      // Close any profile completion claims
      const claims = await base44.entities.Claim.filter({
        team_id: player.team_id,
        player_id: player.id,
        type: 'annet',
        status: 'pending'
      });

      for (const claim of claims) {
        if (claim.description?.includes('Profil ufullstendig')) {
          await base44.entities.Claim.update(claim.id, { status: 'cancelled' });
        }
      }

      onComplete?.();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Kunne ikke lagre profil');
    } finally {
      setSaving(false);
    }
  };

  if (missingFields.length === 0) return null;

  return (
    <Card className="border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-base">Fullfør profilen din</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onDismiss} className="h-6 w-6">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-amber-200 bg-white/50">
          <AlertDescription className="text-sm">
            Vennligst fyll ut følgende felter for å fullføre registreringen: {missingFields.join(', ')}
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {!player?.phone && (
            <div className="space-y-2">
              <Label>Telefonnummer</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({...form, phone: e.target.value})}
                placeholder="99 99 99 99"
              />
            </div>
          )}

          {!player?.notes && (
            <div className="space-y-2">
              <Label>Ekstra informasjon (f.eks. nødkontakt, allergier)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                placeholder="Skriv inn relevant informasjon..."
                rows={3}
              />
            </div>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || (!form.phone && !player?.phone) || (!form.notes && !player?.notes)}
          className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
        >
          {saving ? (
            'Lagrer...'
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Fullfør profil
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}