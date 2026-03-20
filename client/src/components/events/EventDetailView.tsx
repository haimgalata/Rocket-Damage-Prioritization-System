import React, { useState } from 'react';
import { MapPin, Calendar, User, Tag, DollarSign, Activity, Navigation2, X } from 'lucide-react';
import type { DamageEvent } from '../../types';
import { Badge } from '../ui/Badge';
import { AIExplanationBox } from './AIExplanationBox';
import { API_BASE_URL } from '../../config/api';
import {
  getStatusColor,
  getPriorityLabel,
  getPriorityColor,
  formatDateTime,
  formatCurrency,
} from '../../utils/helpers';

const resolveImageUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

interface EventDetailViewProps {
  event: DamageEvent;
}

const formatMeters = (m: number | null | undefined): string => {
  if (m === undefined || m === null || m === -1) return 'Not found';
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
};

export const EventDetailView: React.FC<EventDetailViewProps> = ({ event }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const priorityLabel = getPriorityLabel(event.priorityScore);
  const priorityColorMap: Record<string, 'danger' | 'warning' | 'info' | 'success'> = {
    Critical: 'danger',
    High: 'warning',
    Medium: 'info',
    Low: 'success',
  };

  return (
    <div className="space-y-5">
      {event.name && (
        <h3 className="text-lg font-bold text-gray-900">{event.name}</h3>
      )}

      {event.imageUrl ? (
        <>
          <div
            className="cursor-pointer block w-full mb-4"
            onClick={() => setLightboxOpen(true)}
            title="Click to enlarge"
          >
            <img
              src={resolveImageUrl(event.imageUrl)}
              alt={event.name || 'Damage'}
              className="w-full h-48 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/800x600/1e3a5f/white?text=No+Image';
              }}
            />
            <p className="text-xs text-gray-400 mt-1 text-center">Click to enlarge</p>
          </div>

          {lightboxOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
              onClick={() => setLightboxOpen(false)}
            >
              <div
                className="relative max-w-3xl max-h-[90vh] mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setLightboxOpen(false)}
                  className="absolute -top-3 -right-3 z-10 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>
                <img
                  src={resolveImageUrl(event.imageUrl)}
                  alt={event.name || 'Damage'}
                  className="max-h-[85vh] max-w-full rounded-xl object-contain"
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-28 rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center">
          <p className="text-sm text-gray-400">No image provided</p>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.status)}`}
        >
          {event.status.replace('_', ' ').toUpperCase()}
        </span>
        <Badge variant={priorityColorMap[priorityLabel] || 'default'}>
          {priorityLabel} Priority · {event.priorityScore.toFixed(1)}/10
        </Badge>
        {event.damageClassification && (
          <Badge variant={event.damageClassification === 'Heavy' ? 'danger' : 'warning'}>
            AI: {event.damageClassification} ({event.damageScore}/10)
          </Badge>
        )}
        {event.tags?.map((tag) => (
          <Badge key={tag} variant="default">
            <Tag className="w-3 h-3 mr-1" />
            {tag}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Damage Score</p>
          <p className="text-2xl font-bold text-gray-900">{event.damageScore}<span className="text-sm text-gray-400">/10</span></p>
          <p className="text-xs text-gray-400 mt-0.5">{event.damageClassification || '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Geo Multiplier</p>
          <p className="text-2xl font-bold text-gray-900">
            ×{event.gisDetails?.geoMultiplier?.toFixed(2) ?? '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">GIS factor</p>
        </div>
        <div className={`rounded-lg p-3 text-center ${
          event.priorityScore >= 7.5 ? 'bg-red-50' : event.priorityScore >= 5.0 ? 'bg-orange-50' : 'bg-green-50'
        }`}>
          <p className="text-xs text-gray-500 mb-1">Final Priority</p>
          <p className={`text-2xl font-bold ${
            event.priorityScore >= 7.5 ? 'text-red-600' : event.priorityScore >= 5.0 ? 'text-orange-600' : 'text-green-600'
          }`}>
            {event.priorityScore.toFixed(1)}<span className="text-sm opacity-60">/10</span>
          </p>
          <p className={`text-xs mt-0.5 ${getPriorityColor(event.priorityScore).split(' ')[1]}`}>
            {priorityLabel}
          </p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Description</h4>
        <p className="text-sm text-gray-600">{event.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-gray-500">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{event.location.address}, {event.location.city}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>{formatDateTime(event.createdAt)}</span>
        </div>
        {event.estimatedRepairCost && (
          <div className="flex items-center gap-2 text-gray-500">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span>Est. {formatCurrency(event.estimatedRepairCost)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-gray-500">
          <User className="w-4 h-4 text-gray-400" />
          <span>Event #{event.id.slice(-3)}</span>
        </div>
      </div>

      {event.gisDetails && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Navigation2 className="w-4 h-4 text-blue-500" />
            GIS Proximity Analysis
          </h4>
          {event.gisStatus === 'pending' && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2">
              <svg className="animate-spin w-4 h-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-xs text-blue-700 font-medium">GIS analysis in progress — scores will update automatically...</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Nearest Hospital', value: formatMeters(event.gisDetails.distHospitalM), icon: '🏥' },
              { label: 'Nearest School', value: formatMeters(event.gisDetails.distSchoolM), icon: '🏫' },
              { label: 'Nearest Road', value: formatMeters(event.gisDetails.distRoadM), icon: '🛣️' },
              { label: 'Strategic Site', value: formatMeters(event.gisDetails.distStrategicM), icon: '🎯' },
              { label: 'Population Density', value: `${event.gisDetails.populationDensity.toLocaleString()} /km²`, icon: '👥' },
              { label: 'Geo Multiplier', value: `×${event.gisDetails.geoMultiplier.toFixed(2)}`, icon: '📊' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-base">{icon}</span>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-800">{value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
            <Activity className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Calculation:</span> {event.damageScore} (AI damage) × {event.gisDetails.geoMultiplier.toFixed(2)} (GIS) = <span className="font-bold">{event.priorityScore.toFixed(1)}/10</span>
            </p>
          </div>
        </div>
      )}

      <AIExplanationBox
        explanation={event.llmExplanation}
        model={event.aiModel}
        damageScore={event.damageScore}
        priorityScore={event.priorityScore}
      />
    </div>
  );
};