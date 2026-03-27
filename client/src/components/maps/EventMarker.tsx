import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { DamageEvent } from '../../types';
import { getMarkerColor, getPriorityLabel, formatDate, getStatusColor } from '../../utils/helpers';

interface EventMarkerProps {
  event: DamageEvent;
  onClick?: (event: DamageEvent) => void;
}

const createColoredIcon = (color: string, score: number) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="40" height="52">
      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
      <path d="M20 2C11.16 2 4 9.16 4 18C4 30 20 50 20 50C20 50 36 30 36 18C36 9.16 28.84 2 20 2Z"
        fill="${color}" filter="url(#shadow)" stroke="white" stroke-width="2"/>
      <circle cx="20" cy="18" r="9" fill="white" opacity="0.9"/>
      <text x="20" y="22" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}">${score}</text>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [40, 52],
    iconAnchor: [20, 52],
    popupAnchor: [0, -54],
  });
};

export const EventMarker: React.FC<EventMarkerProps> = ({ event, onClick }) => {
  const color = getMarkerColor(event.priorityScore);
  const icon = createColoredIcon(color, parseFloat(event.priorityScore.toFixed(1)));

  return (
    <Marker
      position={[event.location.lat, event.location.lng]}
      icon={icon}
      eventHandlers={{ click: () => onClick?.(event) }}
    >
      <Popup>
        <div className="min-w-[180px] py-1">
          <p className="font-semibold text-gray-900 text-sm">{event.name}</p>
          <p className="text-xs text-gray-500 mb-2">{event.location.city}</p>
          <div className="flex gap-2 mb-2">
            <span className="text-xs font-medium" style={{ color }}>
              Priority: {event.priorityScore.toFixed(1)}/10 ({getPriorityLabel(event.priorityScore)})
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(event.status)}`}>
            {event.status.replace('_', ' ')}
          </span>
          <p className="text-xs text-gray-400 mt-2">{formatDate(event.createdAt)}</p>
        </div>
      </Popup>
    </Marker>
  );
};
