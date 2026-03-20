import React, { useState } from 'react';
import {
  ArrowUpDown, ArrowUp, ArrowDown,
  Eye, EyeOff, MapPin, Calendar, Pencil, Search, Loader2,
} from 'lucide-react';
import type { DamageEvent } from '../../types';
import { EventStatus, UserRole } from '../../types';
import { Badge } from '../ui/Badge';
import {
  getPriorityLabel,
  getPriorityColor,
  formatDate,
  truncateText,
} from '../../utils/helpers';

type SortField = 'priorityScore' | 'damageScore' | 'createdAt' | 'status';
type SortOrder = 'asc' | 'desc';

interface EventTableProps {
  events:          DamageEvent[];
  onSelectEvent?:  (event: DamageEvent) => void;
  onEditEvent?:    (event: DamageEvent) => void;
  onToggleHide?:   (id: string) => void;
  onUpdateStatus?: (id: string, status: EventStatus) => void;
  selectedEventId?: string;
  compact?:        boolean;
  currentUserId?:  string;
  currentUserRole?: string;
  userNameMap?:    Record<string, string>;
  orgMap?:         Record<string, string>;
}

const statusVariantMap: Record<EventStatus, 'warning' | 'info' | 'success'> = {
  [EventStatus.PENDING]:     'warning',
  [EventStatus.IN_PROGRESS]: 'info',
  [EventStatus.COMPLETED]:   'success',
};

const GisSpinner: React.FC = () => (
  <span className="inline-flex items-center gap-1 text-xs text-blue-500">
    <Loader2 className="w-3 h-3 animate-spin" />
    Loading…
  </span>
);

export const EventTable: React.FC<EventTableProps> = ({
  events,
  onSelectEvent,
  onEditEvent,
  onToggleHide,
  onUpdateStatus,
  selectedEventId,
  compact       = false,
  currentUserId,
  currentUserRole,
  userNameMap   = {},
  orgMap        = {},
}) => {
  const [sortField, setSortField] = useState<SortField>('priorityScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSort = (field: SortField) => {
    setSortField(field);
    setSortOrder(sortField === field && sortOrder === 'desc' ? 'asc' : 'desc');
  };

  const term = searchTerm.trim().toLowerCase();
  const filtered = term
    ? events.filter(
        (e) =>
          (e.name ?? '').toLowerCase().includes(term) ||
          e.location.address.toLowerCase().includes(term) ||
          e.location.city?.toLowerCase().includes(term)
      )
    : events;

  const sorted = [...filtered].sort((a, b) => {
    let valA: number | string, valB: number | string;
    switch (sortField) {
      case 'priorityScore': valA = a.priorityScore; valB = b.priorityScore; break;
      case 'damageScore':   valA = a.damageScore;   valB = b.damageScore;   break;
      case 'createdAt':     valA = new Date(a.createdAt).getTime(); valB = new Date(b.createdAt).getTime(); break;
      case 'status':        valA = a.status;         valB = b.status;        break;
      default:              valA = a.priorityScore; valB = b.priorityScore;
    }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const isAdmin    = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.SUPER_ADMIN;
  const isOperator = currentUserRole === UserRole.OPERATOR;

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-gray-400 inline" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 ml-1 text-blue-500 inline" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1 text-blue-500 inline" />;
  };

  const thClass = 'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 select-none';
  const tdClass = 'px-4 py-3 text-sm text-gray-700 align-middle';

  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or address…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white
              focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-text placeholder-gray-400"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className={thClass}>Event</th>
              {!compact && <th className={thClass}>Description</th>}
              <th className={`${thClass} cursor-pointer hover:bg-gray-100`} onClick={() => handleSort('priorityScore')}>
                Priority <SortIcon field="priorityScore" />
              </th>
              <th className={`${thClass} cursor-pointer hover:bg-gray-100`} onClick={() => handleSort('damageScore')}>
                Damage <SortIcon field="damageScore" />
              </th>
              <th className={`${thClass} cursor-pointer hover:bg-gray-100`} onClick={() => handleSort('status')}>
                Status <SortIcon field="status" />
              </th>
              {!compact && (
                <th className={`${thClass} cursor-pointer hover:bg-gray-100`} onClick={() => handleSort('createdAt')}>
                  Date <SortIcon field="createdAt" />
                </th>
              )}
              <th className={thClass}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={compact ? 5 : 7} className="text-center py-12 text-gray-400 text-sm">
                  {term ? `No events match "${searchTerm}".` : 'No events found.'}
                </td>
              </tr>
            )}

            {sorted.map((event) => {
              const isSelected    = event.id === selectedEventId;
              const isHidden      = event.hidden;
              const isPending     = event.gisStatus === 'pending';
              const isOwner       = currentUserId ? currentUserId === event.createdBy : false;
              const priorityLabel = getPriorityLabel(event.priorityScore);

              let creatorLine: React.ReactNode = null;
              if (isAdmin) {
                const name = userNameMap[event.createdBy] ?? event.createdBy;
                creatorLine = <span className="text-gray-400 text-xs">By: {name}</span>;
              } else if (isOperator && isOwner) {
                creatorLine = <span className="text-blue-500 text-xs font-medium">(You)</span>;
              }

              return (
                <tr
                  key={event.id}
                  className={`border-b border-gray-100 transition-colors ${
                    isHidden ? 'opacity-50 bg-gray-50' : isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className={tdClass}>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <button
                          onClick={() => onSelectEvent?.(event)}
                          className="font-medium text-blue-700 hover:text-blue-900 hover:underline text-xs text-left cursor-pointer transition"
                        >
                          {event.name ?? `Event #${event.id.slice(-3)}`}
                        </button>
                        <p className="text-gray-500 text-xs">{event.location.address}</p>
                        {orgMap[event.organizationId] && (
                          <p className="text-xs text-purple-600 font-medium">{orgMap[event.organizationId]}</p>
                        )}
                        {creatorLine && <p className="mt-0.5">{creatorLine}</p>}
                      </div>
                    </div>
                  </td>

                  {!compact && (
                    <td className={`${tdClass} max-w-xs`}>
                      <span className="text-xs">{truncateText(event.description, 70)}</span>
                    </td>
                  )}

                  <td className={tdClass}>
                    {isPending ? (
                      <GisSpinner />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              event.priorityScore >= 7.5 ? 'bg-red-500'
                                : event.priorityScore >= 5.0 ? 'bg-orange-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${(event.priorityScore / 10) * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${
                          event.priorityScore >= 7.5 ? 'text-red-600'
                            : event.priorityScore >= 5.0 ? 'text-orange-600'
                            : 'text-green-600'
                        }`}>
                          {event.priorityScore.toFixed(1)}
                        </span>
                        <span className={`hidden sm:inline text-xs px-1.5 py-0.5 rounded font-medium ${getPriorityColor(event.priorityScore)}`}>
                          {priorityLabel}
                        </span>
                      </div>
                    )}
                  </td>

                  <td className={tdClass}>
                    <span className="text-xs font-medium text-gray-700">
                      {event.damageScore}/10
                      {event.damageClassification && (
                        <span className={`ml-1 text-xs px-1 py-0.5 rounded ${
                          event.damageClassification === 'Heavy'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {event.damageClassification}
                        </span>
                      )}
                    </span>
                  </td>

                  <td className={tdClass}>
                    {onUpdateStatus ? (
                      <select
                        value={event.status}
                        onChange={(e) => onUpdateStatus(event.id, e.target.value as EventStatus)}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-xs font-medium rounded-full px-2 py-1 border cursor-pointer
                          focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                          event.status === EventStatus.PENDING
                            ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                            : event.status === EventStatus.IN_PROGRESS
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-green-100 text-green-800 border-green-300'
                        }`}
                      >
                        <option value={EventStatus.PENDING}>Pending</option>
                        <option value={EventStatus.IN_PROGRESS}>In Progress</option>
                        <option value={EventStatus.COMPLETED}>Completed</option>
                      </select>
                    ) : (
                      <Badge variant={statusVariantMap[event.status]}>
                        {event.status.replace('_', ' ')}
                      </Badge>
                    )}
                  </td>

                  {!compact && (
                    <td className={tdClass}>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(event.createdAt)}
                      </div>
                    </td>
                  )}

                  <td className={tdClass}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectEvent?.(event)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>

                      {isOwner && onEditEvent && (
                        <button
                          onClick={() => onEditEvent(event)}
                          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 font-medium transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      )}

                      {onToggleHide && (
                        <button
                          onClick={() => onToggleHide(event.id)}
                          title={isHidden ? 'Show event' : 'Hide event'}
                          className={`p-1 rounded transition cursor-pointer ${
                            isHidden
                              ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
