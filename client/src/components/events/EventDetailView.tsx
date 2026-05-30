import React, { useState } from 'react';
import { MapPin, Calendar, User, Tag, DollarSign, Activity, Navigation2, X } from 'lucide-react';
import type { DamageEvent } from '../../types';
import { Badge } from '../ui/Badge';
import { AIExplanationBox } from './AIExplanationBox';
import { API_BASE_URL } from '../../config/api';
import {
  getStatusColor,
  getStatusLabel,
  getPriorityLabel,
  getPriorityColor,
  getDamageLabel,
  formatDateTime,
  formatCurrency,
} from '../../utils/helpers';
import { EventStatus } from '../../types';

const resolveImageUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

interface EventDetailViewProps {
  event: DamageEvent;
}

const formatMeters = (m: number | null | undefined): string => {
  if (m === undefined || m === null || m === -1) return 'לא נמצא';
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
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{event.name}</h3>
      )}

      {event.imageUrl ? (
        <>
          <div
            className="cursor-pointer block w-full mb-4"
            onClick={() => setLightboxOpen(true)}
            title="לחץ להגדלה"
          >
            <img
              src={resolveImageUrl(event.imageUrl)}
              alt={event.name || 'נזק'}
              className="w-full h-48 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/800x600/1e3a5f/white?text=No+Image';
              }}
            />
            <p className="text-xs text-gray-400 mt-1 text-center">לחץ להגדלה</p>
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
                  className="absolute -top-3 -left-3 z-10 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>
                <img
                  src={resolveImageUrl(event.imageUrl)}
                  alt={event.name || 'נזק'}
                  className="max-h-[85vh] max-w-full rounded-xl object-contain"
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-28 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">לא סופקה תמונה</p>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.status)}`}
        >
          {getStatusLabel(event.status as EventStatus)}
        </span>
        <Badge variant={priorityColorMap[priorityLabel] || 'default'}>
          {priorityLabel} עדיפות · {event.priorityScore.toFixed(1)}/10
        </Badge>
        {event.damageClassification && (
          <Badge variant={event.damageClassification === 'Heavy' ? 'danger' : 'warning'}>
            AI: {getDamageLabel(event.damageClassification ?? '')} ({event.damageScore}/10)
          </Badge>
        )}
        {event.tags?.map((tag) => (
          <Badge key={tag} variant="default">
            <Tag className="w-3 h-3 ml-1" />
            {tag}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ציון נזק</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{event.damageScore}<span className="text-sm text-gray-400 dark:text-gray-500">/10</span></p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{event.damageClassification || '—'}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">מכפיל גיאוגרפי</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            ×{event.gisDetails?.geoMultiplier?.toFixed(2) ?? '—'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">גורם GIS</p>
        </div>
        <div className={`rounded-lg p-3 text-center ${
          event.priorityScore >= 7.5 ? 'bg-red-50 dark:bg-red-900/20' : event.priorityScore >= 5.0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-green-50 dark:bg-green-900/20'
        }`}>
          <p className="text-xs text-gray-500 mb-1">עדיפות סופית</p>
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
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">תיאור</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400" dir="auto">{event.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span>{event.location.address}, {event.location.city}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span>{formatDateTime(event.createdAt)}</span>
        </div>
        {event.estimatedRepairCost && (
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <span>הערכה: {formatCurrency(event.estimatedRepairCost)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span>אירוע #{String(event.id).slice(-3)}</span>
        </div>
      </div>

      {event.gisDetails && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <Navigation2 className="w-4 h-4 text-blue-500" />
            ניתוח קרבה GIS
          </h4>
          {event.gisStatus === 'pending' && (
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 mb-2">
              <svg className="animate-spin w-4 h-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">ניתוח GIS בתהליך — הציונים יתעדכנו אוטומטית...</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'בית חולים קרוב', value: formatMeters(event.gisDetails.distHospitalM), icon: '🏥' },
              { label: 'בית ספר קרוב', value: formatMeters(event.gisDetails.distSchoolM), icon: '🏫' },
              { label: 'כביש קרוב', value: formatMeters(event.gisDetails.distRoadM), icon: '🛣️' },
              { label: 'אתר אסטרטגי', value: formatMeters(event.gisDetails.distStrategicM), icon: '🎯' },
              { label: 'צפיפות אוכלוסין', value: `${event.gisDetails.populationDensity.toLocaleString()} /km²`, icon: '👥' },
              { label: 'מכפיל גיאוגרפי', value: `×${event.gisDetails.geoMultiplier.toFixed(2)}`, icon: '📊' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-base">{icon}</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
            <Activity className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-400">
              <span className="font-semibold">חישוב:</span> {event.damageScore} (נזק AI) × {event.gisDetails.geoMultiplier.toFixed(2)} (GIS) = <span className="font-bold">{event.priorityScore.toFixed(1)}/10</span>
            </p>
          </div>
        </div>
      )}

      {event.history && event.history.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">היסטוריית סטטוס</h4>
          <ul className="space-y-2 text-sm border border-gray-100 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
            {event.history.map((h, i) => (
              <li key={`${h.changedAt}-${i}`} className="px-3 py-2 text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-800 dark:text-gray-200">{h.oldStatus ? getStatusLabel(h.oldStatus as EventStatus) : '—'}</span>
                {' → '}
                <span className="font-medium text-gray-800 dark:text-gray-200">{getStatusLabel(h.newStatus as EventStatus)}</span>
                <span className="text-gray-400 dark:text-gray-600"> · </span>
                {h.changedByName || `User #${h.changedBy}`}
                <span className="text-gray-400 dark:text-gray-600"> · </span>
                {formatDateTime(h.changedAt)}
              </li>
            ))}
          </ul>
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