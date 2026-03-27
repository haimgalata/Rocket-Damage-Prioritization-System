import React, { useState, useEffect } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location } from '../../types';
import { MapPin } from 'lucide-react';

interface LocationPickerProps {
  value?: Location;
  onChange: (location: Location) => void;
  height?: string;
}

const ClickHandler: React.FC<{ onLocationChange: (lat: number, lng: number) => void }> = ({
  onLocationChange,
}) => {
  useMapEvents({ click(e) { onLocationChange(e.latlng.lat, e.latlng.lng); } });
  return null;
};

// Flies the map to a new position when it changes externally (e.g. geolocation)
const FlyToLocation: React.FC<{ position: [number, number] | null }> = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 1.2 });
  }, [position?.[0], position?.[1]]);
  return null;
};

export const LocationPicker: React.FC<LocationPickerProps> = ({
  value,
  onChange,
  height = '280px',
}) => {
  const [marker, setMarker] = useState<[number, number] | null>(
    value ? [value.lat, value.lng] : null
  );

  // Sync external value changes into internal marker (e.g. from geolocation)
  useEffect(() => {
    if (value) setMarker([value.lat, value.lng]);
  }, [value?.lat, value?.lng]);

  const handleMapClick = (lat: number, lng: number) => {
    const rounded = { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 };
    setMarker([rounded.lat, rounded.lng]);
    onChange({ lat: rounded.lat, lng: rounded.lng, address: `${rounded.lat.toFixed(4)}, ${rounded.lng.toFixed(4)}` });
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
        <MapPin className="w-4 h-4 text-blue-500" />
        {marker
          ? <span className="font-medium text-blue-700">{marker[0].toFixed(5)}, {marker[1].toFixed(5)}</span>
          : <span className="text-gray-400">Click the map, type an address, or use GPS below</span>}
      </div>
      <div style={{ height }} className="rounded-xl overflow-hidden border border-gray-200">
        <LeafletMapContainer center={marker || [32.0853, 34.7818]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onLocationChange={handleMapClick} />
          <FlyToLocation position={marker} />
          {marker && <Marker position={marker} />}
        </LeafletMapContainer>
      </div>
    </div>
  );
};
