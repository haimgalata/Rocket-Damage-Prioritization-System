import React, { useState, useEffect, useMemo } from 'react';
import { X, Map, Layers } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { EventTable } from '../../components/events/EventTable';
import { EditEventModal } from '../../components/events/EditEventModal';
import { EventMap } from '../../components/maps/MapContainer';
import { EventDetailView } from '../../components/events/EventDetailView';
import { useEventStore } from '../../store/authStore';
import { useAuth } from '../../hooks';
import { MOCK_EVENTS, MOCK_USERS, MOCK_ORGANIZATIONS } from '../../data/mockData';
import { EventStatus } from '../../types';
import type { DamageEvent } from '../../types';
import { API_BASE_URL } from '../../config/api';

type MapMode    = 'pins' | 'heatmap';
type FilterStatus = 'all' | EventStatus;

export const EventsPage: React.FC = () => {
  const { user } = useAuth();
  const { events, setEvents, toggleHideEvent, updateEvent } = useEventStore();
  const [searchParams] = useSearchParams();
  const orgFilter = searchParams.get('org');

  const orgMap = useMemo(() => {
    const map: Record<string, string> = {};
    MOCK_ORGANIZATIONS.forEach(o => { map[o.id] = o.name; });
    return map;
  }, []);

  const [selectedEvent,  setSelectedEvent]  = useState<DamageEvent | null>(null);
  const [editingEvent,   setEditingEvent]   = useState<DamageEvent | null>(null);
  const [isDetailOpen,   setIsDetailOpen]   = useState(false);
  const [isEditOpen,     setIsEditOpen]     = useState(false);
  const [filterStatus,   setFilterStatus]   = useState<FilterStatus>('all');
  const [mapMode,        setMapMode]        = useState<MapMode>('pins');
  const [showHidden,     setShowHidden]     = useState(false);
  const [mapFocusEvent,  setMapFocusEvent]  = useState<DamageEvent | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/events`);
        if (res.ok) {
          const data: DamageEvent[] = await res.json();
          if (data.length > 0) { setEvents(data); return; }
        }
      } catch { /* backend unavailable — fall through to mock */ }
      if (events.length === 0) setEvents(MOCK_EVENTS);
    };
    load();
  }, []);

  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    MOCK_USERS.forEach((u) => { map[u.id] = u.name; });
    return map;
  }, []);

  const baseOrgId     = orgFilter || (user?.role !== 'SUPER_ADMIN' ? user?.organizationId : null);
  const orgEvents     = baseOrgId ? events.filter((e) => e.organizationId === baseOrgId) : events;
  const statusFiltered = filterStatus === 'all' ? orgEvents : orgEvents.filter((e) => e.status === filterStatus);
  const displayEvents  = showHidden ? statusFiltered : statusFiltered.filter((e) => !e.hidden);

  const handleSelectEvent = (event: DamageEvent) => {
    setSelectedEvent(event);
    setIsDetailOpen(true);
    setMapFocusEvent(event);
  };

  const handleEditEvent = (event: DamageEvent) => {
    setEditingEvent(event);
    setIsEditOpen(true);
  };

  const handleSaveEdit = (id: string, updates: Partial<DamageEvent>) => {
    updateEvent(id, updates);
    if (selectedEvent?.id === id) {
      setSelectedEvent((prev) => prev ? { ...prev, ...updates } : prev);
    }
  };

  const filterButtons: { label: string; value: FilterStatus; count: number }[] = [
    { label: 'All',         value: 'all',                   count: orgEvents.length },
    { label: 'Pending',     value: EventStatus.PENDING,     count: orgEvents.filter((e) => e.status === EventStatus.PENDING).length },
    { label: 'In Progress', value: EventStatus.IN_PROGRESS, count: orgEvents.filter((e) => e.status === EventStatus.IN_PROGRESS).length },
    { label: 'Completed',   value: EventStatus.COMPLETED,   count: orgEvents.filter((e) => e.status === EventStatus.COMPLETED).length },
  ];

  return (
    <PageContainer title="Events">
      <div className="max-w-[1400px] mx-auto space-y-6">

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
            {filterButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setFilterStatus(btn.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  filterStatus === btn.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {btn.label}
                <span className={`ml-1.5 text-xs ${filterStatus === btn.value ? 'text-blue-200' : 'text-gray-400'}`}>
                  {btn.count}
                </span>
              </button>
            ))}
          </div>
          {filterStatus !== 'all' && (
            <button
              onClick={() => setFilterStatus('all')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
            >
              <X className="w-4 h-4" /> Clear filter
            </button>
          )}
        </div>

        <Card
          title="Map View"
          subtitle={mapMode === 'pins' ? 'Color-coded by priority' : 'Damage heatmap'}
          noPadding
          headerRight={
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setMapMode('pins')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${mapMode === 'pins' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Map className="w-3.5 h-3.5" /> Pins
              </button>
              <button
                onClick={() => setMapMode('heatmap')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${mapMode === 'heatmap' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Layers className="w-3.5 h-3.5" /> Heatmap
              </button>
            </div>
          }
        >
          <div className="p-4">
            <EventMap
              events={orgEvents.filter((e) => !e.hidden)}
              height="460px"
              onEventClick={handleSelectEvent}
              mode={mapMode}
              focusEvent={mapFocusEvent}
            />
            {mapMode === 'pins' && (
              <div className="flex items-center gap-4 mt-3">
                {[
                  { color: 'bg-red-500',    label: 'Critical (≥7.5)' },
                  { color: 'bg-orange-500', label: 'High (5–7.4)'    },
                  { color: 'bg-green-500',  label: 'Low–Med (<5)'    },
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
          title="Event List"
          subtitle={`${displayEvents.length} records · sorted by priority`}
          noPadding
          headerRight={
            <button
              onClick={() => setShowHidden((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer"
            >
              {showHidden ? 'Hide hidden' : 'Show hidden'}
            </button>
          }
        >
          <EventTable
            events={displayEvents}
            onSelectEvent={handleSelectEvent}
            onEditEvent={handleEditEvent}
            onToggleHide={toggleHideEvent}
            onUpdateStatus={(id, status) => updateEvent(id, { status })}
            selectedEventId={selectedEvent?.id}
            currentUserId={user?.id}
            currentUserRole={user?.role}
            userNameMap={userNameMap}
            orgMap={user?.role === 'SUPER_ADMIN' ? orgMap : {}}
          />
        </Card>
      </div>

      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedEvent?.name ?? 'Event Detail'}
        size="lg"
      >
        {selectedEvent && <EventDetailView event={selectedEvent} />}
      </Modal>

      <EditEventModal
        event={editingEvent}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={handleSaveEdit}
      />
    </PageContainer>
  );
};
