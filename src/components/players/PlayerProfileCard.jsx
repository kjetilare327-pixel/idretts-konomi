import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { User, Edit, Upload, Instagram, Facebook, Twitter, AtSign, Loader2 } from 'lucide-react';
import { formatNOK } from '@/components/shared/FormatUtils';

export default function PlayerProfileCard({ player, onUpdate, isOwnProfile = false }) {
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    position: player.position || '',
    bio: player.bio || '',
    phone: player.phone || '',
    social_media: player.social_media || {}
  });

  const handleSave = async () => {
    await base44.entities.Player.update(player.id, formData);
    setEditing(false);
    if (onUpdate) onUpdate();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Player.update(player.id, {
        profile_picture_url: file_url
      });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <div className="relative">
            <Avatar className="w-20 h-20">
              <AvatarImage src={player.profile_picture_url} alt={player.full_name} />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                {getInitials(player.full_name)}
              </AvatarFallback>
            </Avatar>
            {isOwnProfile && (
              <label className="absolute bottom-0 right-0 bg-white dark:bg-slate-800 rounded-full p-1.5 shadow-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <Upload className="w-4 h-4 text-indigo-600" />
                )}
              </label>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">{player.full_name}</h3>
                {player.position && (
                  <Badge variant="outline" className="mt-1">
                    {player.position}
                  </Badge>
                )}
              </div>
              {isOwnProfile && (
                <Dialog open={editing} onOpenChange={setEditing}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Edit className="w-4 h-4" />
                      Rediger
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Rediger profil</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Posisjon</Label>
                        <Input
                          value={formData.position}
                          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                          placeholder="F.eks. Angriper, Keeper, Midtbane..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefon</Label>
                        <Input
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="Telefonnummer"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Om meg</Label>
                        <Textarea
                          value={formData.bio}
                          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                          placeholder="Skriv litt om deg selv..."
                          rows={4}
                        />
                      </div>
                      <div className="space-y-3">
                        <Label>Sosiale medier</Label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Instagram className="w-5 h-5 text-pink-500" />
                            <Input
                              value={formData.social_media?.instagram || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                social_media: { ...formData.social_media, instagram: e.target.value }
                              })}
                              placeholder="Instagram brukernavn"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Facebook className="w-5 h-5 text-blue-500" />
                            <Input
                              value={formData.social_media?.facebook || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                social_media: { ...formData.social_media, facebook: e.target.value }
                              })}
                              placeholder="Facebook profil URL"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Twitter className="w-5 h-5 text-blue-400" />
                            <Input
                              value={formData.social_media?.twitter || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                social_media: { ...formData.social_media, twitter: e.target.value }
                              })}
                              placeholder="Twitter/X brukernavn"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <AtSign className="w-5 h-5 text-slate-500" />
                            <Input
                              value={formData.social_media?.tiktok || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                social_media: { ...formData.social_media, tiktok: e.target.value }
                              })}
                              placeholder="TikTok brukernavn"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setEditing(false)}>
                          Avbryt
                        </Button>
                        <Button onClick={handleSave}>
                          Lagre endringer
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {player.bio && (
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{player.bio}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {player.social_media?.instagram && (
            <a
              href={`https://instagram.com/${player.social_media.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-950/50 transition-colors"
            >
              <Instagram className="w-4 h-4" />
              <span className="text-sm">Instagram</span>
            </a>
          )}
          {player.social_media?.facebook && (
            <a
              href={player.social_media.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
            >
              <Facebook className="w-4 h-4" />
              <span className="text-sm">Facebook</span>
            </a>
          )}
          {player.social_media?.twitter && (
            <a
              href={`https://twitter.com/${player.social_media.twitter.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
            >
              <Twitter className="w-4 h-4" />
              <span className="text-sm">Twitter</span>
            </a>
          )}
          {player.social_media?.tiktok && (
            <a
              href={`https://tiktok.com/@${player.social_media.tiktok.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <AtSign className="w-4 h-4" />
              <span className="text-sm">TikTok</span>
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t">
          <div>
            <p className="text-xs text-slate-500">Saldo</p>
            <p className={`font-semibold ${player.balance > 0 ? 'text-red-600' : player.balance < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
              {player.balance > 0 ? `Skylder ${formatNOK(player.balance)}` : player.balance < 0 ? `Kreditt ${formatNOK(-player.balance)}` : 'Ingen utestående'}
            </p>
          </div>
          {player.phone && (
            <div>
              <p className="text-xs text-slate-500">Telefon</p>
              <p className="font-medium">{player.phone}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}