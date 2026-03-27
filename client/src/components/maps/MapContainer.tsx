import React, { useEffect, useRef } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { DamageEvent } from '../../types';
import { EventMarker } from './EventMarker';

import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const FlyToEvent: React.FC<{ event: DamageEvent | null }> = ({ event }) => {
  const map = useMap();
  useEffect(() => {
    if (!event) return;
    map.flyTo([event.location.lat, event.location.lng], 16, { duration: 1.4 });
    const timer = setTimeout(() => {
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          const pos = layer.getLatLng();
          if (
            Math.abs(pos.lat - event.location.lat) < 0.0001 &&
            Math.abs(pos.lng - event.location.lng) < 0.0001
          ) {
            layer.openPopup();
          }
        }
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [event]);
  return null;
};

interface HeatmapPoint { lat: number; lng: number; intensity: number }

const CanvasHeatmapLayer: React.FC<{ points: HeatmapPoint[] }> = ({ points }) => {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (points.length === 0) return;

    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '400';

    const pane = map.getPane('overlayPane')!;
    pane.appendChild(canvas);

    const draw = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);

      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const r = 70;

      points.forEach((pt) => {
        const px = map.latLngToContainerPoint([pt.lat, pt.lng]);
        const grad = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, r);
        const alpha = Math.min(0.85, pt.intensity * 0.6 + 0.25);

        if (pt.intensity >= 0.75) {
          grad.addColorStop(0, `rgba(220,38,38,${alpha})`);
          grad.addColorStop(0.5, `rgba(249,115,22,${alpha * 0.5})`);
        } else if (pt.intensity >= 0.5) {
          grad.addColorStop(0, `rgba(249,115,22,${alpha})`);
          grad.addColorStop(0.5, `rgba(234,179,8,${alpha * 0.5})`);
        } else {
          grad.addColorStop(0, `rgba(234,179,8,${alpha})`);
          grad.addColorStop(0.5, `rgba(34,197,94,${alpha * 0.4})`);
        }
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(px.x, px.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });
    };

    map.on('moveend zoomend resize', draw);
    draw();

    return () => {
      map.off('moveend zoomend resize', draw);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [map, points]);

  return null;
};

interface EventMapProps {
  events: DamageEvent[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onEventClick?: (event: DamageEvent) => void;
  mode?: 'pins' | 'heatmap';
  focusEvent?: DamageEvent | null;
}

export const EventMap: React.FC<EventMapProps> = ({
  events,
  center = [32.0853, 34.7818],
  zoom = 13,
  height = '400px',
  onEventClick,
  mode = 'pins',
  focusEvent = null,
}) => {
  const heatmapPoints: HeatmapPoint[] = events.map((e) => ({
    lat: e.location.lat,
    lng: e.location.lng,
    intensity: e.priorityScore / 10,
  }));

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden border border-gray-200">
      <LeafletMapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mode === 'pins' && events.map((event) => (
          <EventMarker key={event.id} event={event} onClick={onEventClick} />
        ))}
        {mode === 'heatmap' && <CanvasHeatmapLayer points={heatmapPoints} />}
        <FlyToEvent event={focusEvent} />
      </LeafletMapContainer>
    </div>
  );
};