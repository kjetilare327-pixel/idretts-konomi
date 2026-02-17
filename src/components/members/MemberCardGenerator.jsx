import React, { useRef, useState, useEffect } from 'react';
import { useTeam } from '@/components/shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Download, QrCode } from 'lucide-react';
import QRCode from 'npm:qrcode@^1.5.3';

function CardPreview({ player, currentTeam, onDownload }) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    const qrValue = `${currentTeam?.name}|${player.full_name}|${player.user_email}|${player.id}`;
    QRCode.toDataURL(qrValue, { errorCorrectionLevel: 'H', width: 150 }).then(setQrDataUrl);
  }, [player, currentTeam]);

  return (
    <div className="space-y-2">
      <div
        id={`card-${player.id}`}
        className="w-full h-56 rounded-lg border border-slate-200 bg-gradient-to-br from-blue-50 to-purple-50 p-6 shadow-sm flex flex-col justify-between"
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-slate-900">{player.full_name}</h3>
            <p className="text-xs text-slate-600">{currentTeam?.name}</p>
          </div>
          {player.profile_picture_url && (
            <img
              src={player.profile_picture_url}
              alt={player.full_name}
              className="w-16 h-16 rounded object-cover border border-slate-200"
            />
          )}
        </div>

        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs text-slate-600 uppercase">Rolle</p>
            <Badge variant="outline" className="mt-1">
              {player.role === 'player' ? 'Spiller' : 'Forelder'}
            </Badge>
          </div>
          {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="w-20 h-20" />}
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => onDownload(player)}
        className="w-full gap-2"
      >
        <Download className="w-4 h-4" />
        Last ned kort
      </Button>
    </div>
  );
}

export default function MemberCardGenerator() {
  const { currentTeam } = useTeam();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const cardRef = useRef(null);

  const { data: players = [] } = useQuery({
    queryKey: ['players', currentTeam?.id],
    queryFn: () => base44.entities.Player.filter({ team_id: currentTeam?.id, status: 'active' }),
    enabled: !!currentTeam
  });

  const filteredPlayers = players.filter(p => {
    const searchMatch = p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       p.user_email.toLowerCase().includes(searchQuery.toLowerCase());
    const roleMatch = roleFilter === 'all' || p.role === roleFilter;
    return searchMatch && roleMatch;
  });

  const downloadCard = async (player) => {
    const cardElement = document.getElementById(`card-${player.id}`);
    if (!cardElement) return;

    const qrValue = `${currentTeam?.name}|${player.full_name}|${player.user_email}|${player.id}`;
    const qrDataUrl = await QRCode.toDataURL(qrValue, { errorCorrectionLevel: 'H', width: 150 });
    
    const qrImg = cardElement.querySelector('.qr-placeholder');
    if (qrImg) {
      qrImg.src = qrDataUrl;
    }

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(cardElement, {
      backgroundColor: '#ffffff',
      scale: 2
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${player.full_name}-medlemskort.png`;
    link.click();
  };

  const printCards = async () => {
    const printWindow = window.open('', '_blank');
    
    // Generate QR codes for all players
    const qrImages = {};
    for (const player of filteredPlayers) {
      const qrValue = `${currentTeam?.name}|${player.full_name}|${player.user_email}|${player.id}`;
      qrImages[player.id] = await QRCode.toDataURL(qrValue, { errorCorrectionLevel: 'H', width: 100 });
    }

    const cardsHTML = filteredPlayers.map(player => `
      <div style="page-break-after: always; display: flex; justify-content: center; align-items: center; min-height: 100vh;">
        <div style="
          width: 350px;
          height: 220px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: linear-gradient(135deg, #f0f9ff 0%, #f5f3ff 100%);
          padding: 24px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #1e293b;">${player.full_name}</h3>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">${currentTeam?.name}</p>
            </div>
            ${player.profile_picture_url ? `<img src="${player.profile_picture_url}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 2px solid #e2e8f0;" />` : ''}
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <p style="margin: 0; font-size: 10px; color: #94a3b8; text-transform: uppercase;">Rolle</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 600; color: #1e293b;">
                ${player.role === 'player' ? 'Spiller' : 'Forelder'}
              </p>
            </div>
            <img src="${qrImages[player.id]}" style="width: 80px; height: 80px;" />
          </div>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Medlemskort</title>
          <style>
            body { margin: 0; padding: 20px; }
            @media print { body { margin: 0; padding: 0; } }
          </style>
        </head>
        <body>${cardsHTML}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <QrCode className="w-5 h-5 text-purple-600" />
                Medlemskortgenerator
              </CardTitle>
              <CardDescription>
                Generer og skriv ut medlemskort med QR-kode
              </CardDescription>
            </div>
            <Button onClick={printCards} disabled={filteredPlayers.length === 0} className="gap-2 bg-purple-600 hover:bg-purple-700">
              <Printer className="w-4 h-4" />
              Skriv ut ({filteredPlayers.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Søk etter navn eller e-post..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle roller</SelectItem>
                <SelectItem value="player">Spillere</SelectItem>
                <SelectItem value="parent">Foreldre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredPlayers.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Ingen medlemmer funnet
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlayers.map(player => (
                <CardPreview key={player.id} player={player} currentTeam={currentTeam} onDownload={downloadCard} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}