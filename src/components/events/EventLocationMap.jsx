import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}>
      <Popup>Du har valgt denne plasseringen</Popup>
    </Marker>
  );
}

export default function EventLocationMap({ form, setForm }) {
  const [searchQuery, setSearchQuery] = useState(form.location || '');
  const [position, setPosition] = useState(
    form.location_lat && form.location_lng
      ? { lat: form.location_lat, lng: form.location_lng }
      : { lat: 59.9139, lng: 10.7522 } // Oslo default
  );
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (position) {
      setForm({
        ...form,
        location_lat: position.lat,
        location_lng: position.lng
      });
    }
  }, [position]);

  const searchLocation = async () => {
    if (!searchQuery) return;

    setSearching(true);
    try {
      // Using OpenStreetMap Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        setPosition({
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        });
        setForm({
          ...form,
          location: result.display_name,
          location_lat: parseFloat(result.lat),
          location_lng: parseFloat(result.lon)
        });
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-indigo-500" />
        <h3 className="font-medium">Plassering på kart</h3>
      </div>

      <div className="space-y-2">
        <Label>Søk etter sted</Label>
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="F.eks. Ullevaal Stadion, Oslo"
            onKeyPress={(e) => e.key === 'Enter' && searchLocation()}
          />
          <Button
            type="button"
            onClick={searchLocation}
            disabled={searching}
            className="gap-2"
          >
            <Search className="w-4 h-4" />
            {searching ? 'Søker...' : 'Søk'}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Eller klikk på kartet for å velge plassering
        </p>
      </div>

      <div className="h-64 rounded-lg overflow-hidden border">
        <MapContainer
          center={[position.lat, position.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} />
        </MapContainer>
      </div>

      {form.location_lat && form.location_lng && (
        <p className="text-xs text-emerald-600">
          ✓ Plassering lagret: {form.location_lat.toFixed(4)}, {form.location_lng.toFixed(4)}
        </p>
      )}
    </div>
  );
}