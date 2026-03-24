import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, TrendingUp,
  Activity, RefreshCw, X, Eye, EyeOff, Map, Layers,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { EventTable } from '../../components/events/EventTable';
import { EventMap } from '../../components/maps/MapContainer';
import { EventDetailView } from '../../components/events/EventDetailView';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../hooks';
import { useNotificationStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import type { DamageEvent } from '../../types';
import { fetchEvents, patchEventApi } from '../../api/events';
import { EventStatus } from '../../types';
import { formatScore } from '../../utils/helpers';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  delta?: string;
  deltaPositive?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, iconBg, delta, deltaPositive }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
    </div>
    <p className="text-3xl font-bold text-gray-900">{value}</p>
    {delta && (
      <p className={`text-xs mt-1.5 flex items-center gap-1 ${deltaPositive ? 'text-green-600' : 'text-red-500'}`}>
        <TrendingUp className="w-3.5 h-3.5" />
        {delta}
      </p>
    )}
  </div>
);

type FilterStatus = 'all' | EventStatus;
type MapMode = 'pins' | 'heatmap';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { events, setEvents, updateEvent } = useEventStore();
  const { setNotifications } = useNotificationStore();

  const [selectedEvent, setSelectedEvent] = useState<DamageEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('pins');
  const [mapFocusEvent, setMapFocusEvent] = useState<DamageEvent | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchEvents();
        setEvents(data);
      } catch { /* backend unavailable */ }
    };
    load();
    setNotifications([]);
  }, []);

  const orgEvents =
    user?.role === 'SUPER_ADMIN'
      ? events
      : events.filter(
          (e) =>
            user?.organizationId != null && e.organizationId === user.organizationId,
        );

  const statusFiltered = filterStatus === 'all'
    ? orgEvents
    : orgEvents.filter((e) => e.status === filterStatus);

  const displayEvents = showHidden
    ? statusFiltered
    : statusFiltered.filter((e) => !e.hidden);

  const mapEvents = orgEvents.filter((e) => !e.hidden);

  const total       = orgEvents.length;
  const pending     = orgEvents.filter((e) => e.status === EventStatus.NEW).length;
  const inProgress  = orgEvents.filter((e) => e.status === EventStatus.IN_PROGRESS).length;
  const completed   = orgEvents.filter((e) => e.status === EventStatus.DONE).length;
  const avgPriority = total > 0 ? orgEvents.reduce((s, e) => s + e.priorityScore, 0) / total : 0;
  const criticalCount = orgEvents.filter((e) => e.priorityScore >= 7.5).length;
  const hiddenCount   = orgEvents.filter((e) => e.hidden).length;

  const handleSelectEvent = (event: DamageEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
    setMapFocusEvent(event);        // triggers FlyToEvent inside the map
  };

  const handleToggleHide = async (id: number) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    try {
      const updated = await patchEventApi(id, { hidden: !ev.hidden });
      updateEvent(id, updated);
      if (selectedEvent?.id === id) setSelectedEvent(updated);
    } catch {
      /* ignore */
    }
  };

  const filterButtons: { label: string; value: FilterStatus; count: number }[] = [
    { label: 'All',         value: 'all',                   count: total },
    { label: 'New',         value: EventStatus.NEW,         count: pending },
    { label: 'In Progress', value: EventStatus.IN_PROGRESS, count: inProgress },
    { label: 'Done',        value: EventStatus.DONE,        count: completed },
  ];

  return (
    <PageContainer title="Operations Dashboard">
      <div className="space-y-6 max-w-[1400px] mx-auto">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Events" value={total}
            icon={<Activity className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-100" />
          <StatCard label="New" value={pending}
            icon={<Clock className="w-5 h-5 text-yellow-600" />} iconBg="bg-yellow-100"
            delta={criticalCount > 0 ? `${criticalCount} critical` : undefined} deltaPositive={false} />
          <StatCard label="In Progress" value={inProgress}
            icon={<RefreshCw className="w-5 h-5 text-indigo-600" />} iconBg="bg-indigo-100" />
          <StatCard label="Done" value={completed}
            icon={<CheckCircle2 className="w-5 h-5 text-green-600" />} iconBg="bg-green-100"
            delta={total > 0 ? `${Math.round((completed / total) * 100)}% resolution rate` : undefined}
            deltaPositive />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white shadow-sm">
            <p className="text-blue-200 text-sm mb-1">Avg Priority Score</p>
            <p className="text-4xl font-bold">{avgPriority.toFixed(1)}</p>
            <div className="mt-2 h-1.5 bg-blue-500/50 rounded-full">
              <div className="h-full bg-white rounded-full" style={{ width: `${(avgPriority / 10) * 100}%` }} />
            </div>
            <p className="text-blue-200 text-xs mt-1">Out of 10</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-5 text-white shadow-sm">
            <p className="text-red-100 text-sm mb-1">Critical Events (≥7.5)</p>
            <p className="text-4xl font-bold">{criticalCount}</p>
            <p className="text-red-200 text-xs mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Require immediate attention
            </p>
          </div>
          <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl p-5 text-white shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Hidden Events</p>
              <p className="text-4xl font-bold">{hiddenCount}</p>
              <p className="text-slate-400 text-xs mt-1">Filtered from view</p>
            </div>
            {hiddenCount > 0 && (
              <button onClick={() => setShowHidden((v) => !v)}
                className="mt-3 flex items-center gap-2 text-sm text-slate-300 hover:text-white transition">
                {showHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showHidden ? 'Hide hidden events' : 'Show hidden events'}
              </button>
            )}
          </div>
        </div>

        <Card
          title="Event Map"
          subtitle={mapMode === 'pins' ? 'Click a row to zoom in · color-coded by priority' : 'Damage density heatmap'}
          noPadding
          headerRight={
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setMapMode('pins')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  mapMode === 'pins' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Map className="w-3.5 h-3.5" /> Pins
              </button>
              <button onClick={() => setMapMode('heatmap')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  mapMode === 'heatmap' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Layers className="w-3.5 h-3.5" /> Heatmap
              </button>
            </div>
          }
        >
          <div className="p-4">
            <EventMap
              events={mapEvents}
              height="420px"
              onEventClick={handleSelectEvent}
              mode={mapMode}
              focusEvent={mapFocusEvent}
            />
            {mapMode === 'pins' && (
              <div className="flex items-center gap-4 mt-3 px-1">
                <span className="text-xs text-gray-500 font-medium">Legend:</span>
                {[
                  { color: 'bg-red-500',    label: 'Critical (≥7.5)' },
                  { color: 'bg-orange-500', label: 'High (5–7.4)' },
                  { color: 'bg-green-500',  label: 'Low–Med (<5)' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${color}`} />
                    <span className="text-xs text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card
          title="Damage Events"
          subtitle={`${displayEvents.length} records · sorted by priority`}
          noPadding
          headerRight={
            <div className="flex items-center gap-2">
              {filterStatus !== 'all' && (
                <button onClick={() => setFilterStatus('all')}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {filterButtons.map((btn) => (
                  <button key={btn.value} onClick={() => setFilterStatus(btn.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      filterStatus === btn.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {btn.label}
                    <span className={`ml-1 text-xs ${filterStatus === btn.value ? 'text-blue-500' : 'text-gray-400'}`}>
                      {btn.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <EventTable
            events={displayEvents}
            onSelectEvent={handleSelectEvent}
            onToggleHide={handleToggleHide}
            selectedEventId={selectedEvent?.id}
            compact
          />
        </Card>

        {total > 0 && (
          <Card title="Priority Distribution">
            <div className="flex gap-0 rounded-full overflow-hidden h-4 mb-3">
              <div className="bg-red-500 transition-all"
                style={{ width: `${(orgEvents.filter((e) => e.priorityScore >= 7.5).length / total) * 100}%` }} />
              <div className="bg-orange-400 transition-all"
                style={{ width: `${(orgEvents.filter((e) => e.priorityScore >= 5.0 && e.priorityScore < 7.5).length / total) * 100}%` }} />
              <div className="bg-green-500 transition-all"
                style={{ width: `${(orgEvents.filter((e) => e.priorityScore < 5.0).length / total) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span><span className="font-semibold text-red-600">{orgEvents.filter((e) => e.priorityScore >= 7.5).length}</span> Critical</span>
              <span><span className="font-semibold text-orange-500">{orgEvents.filter((e) => e.priorityScore >= 5.0 && e.priorityScore < 7.5).length}</span> High</span>
              <span><span className="font-semibold text-green-600">{orgEvents.filter((e) => e.priorityScore < 5.0).length}</span> Low–Medium</span>
              <span className="ml-auto text-gray-400">Avg: {formatScore(avgPriority)}</span>
            </div>
          </Card>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedEvent ? `Event: ${selectedEvent.name}` : 'Event Detail'}
        size="lg"
      >
        {selectedEvent && <EventDetailView event={selectedEvent} />}
      </Modal>
    </PageContainer>
  );
};