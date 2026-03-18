import React from 'react';
import { MapPin, Calendar, User, Tag, DollarSign, Activity, Navigation2 } from 'lucide-react';
import type { DamageEvent } from '../../types';
import { Badge } from '../ui/Badge';
import { AIExplanationBox } from './AIExplanationBox';
import {
  getStatusColor,
  getPriorityLabel,
  getPriorityColor,
  formatDateTime,
  formatCurrency,
} from '../../utils/helpers';

interface EventDetailViewProps {
  event: DamageEvent;
}

const formatMeters = (m: number): string => {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
};

export const EventDetailView: React.FC<EventDetailViewProps> = ({ event }) => {
  const priorityLabel = getPriorityLabel(event.priorityScore);
  const priorityColorMap: Record<string, 'danger' | 'warning' | 'info' | 'success'> = {
    Critical: 'danger',
    High: 'warning',
    Medium: 'info',
    Low: 'success',
  };

  return (
    <div className="space-y-5">
      {/* Event Name */}
      {event.name && (
        <h3 className="text-lg font-bold text-gray-900">{event.name}</h3>
      )}

      {/* Image */}
      {event.imageUrl ? (
        <img
          src={event.imageUrl}
          alt={event.name || 'Damage'}
          className="w-full h-48 object-cover rounded-xl border border-gray-200"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://placehold.co/400x300/1e3a5f/white?text=No+Image';
          }}
        />
      ) : (
        <div className="w-full h-48 rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center">
          <p className="text-sm text-gray-400">No image provided</p>
        </div>
      )}

      {/* Status & Priority */}
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

      {/* Score Summary */}
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

      {/* Description */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Description</h4>
        <p className="text-sm text-gray-600">{event.description}</p>
      </div>

      {/* Meta */}
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

      {/* GIS Details */}
      {event.gisDetails && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Navigation2 className="w-4 h-4 text-blue-500" />
            GIS Proximity Analysis
          </h4>
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

      {/* AI Explanation */}
      <AIExplanationBox
        explanation={event.llmExplanation}
        model={event.aiModel}
        damageScore={event.damageScore}
        priorityScore={event.priorityScore}
      />
    </div>
  );
};