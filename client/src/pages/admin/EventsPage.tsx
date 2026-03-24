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
import { useEventStore } from '../../store/eventStore';
import { patchEventApi } from '../../api/events';
import { useAuth } from '../../hooks';
import { fetchOrganizations } from '../../api/organizations';
import { fetchUsers } from '../../api/auth';
import { EventStatus } from '../../types';
import type { DamageEvent } from '../../types';
import { fetchEvents } from '../../api/events';

type MapMode    = 'pins' | 'heatmap';
type FilterStatus = 'all' | EventStatus;

export const EventsPage: React.FC = () => {
  const { user } = useAuth();
  const { events, setEvents, updateEvent } = useEventStore();
  const [searchParams] = useSearchParams();
  const orgFilter = searchParams.get('org');

  const [orgs, setOrgs] = useState<{ id: number; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const orgMap = useMemo(() => {
    const map: Record<number, string> = {};
    orgs.forEach(o => { map[o.id] = o.name; });
    return map;
  }, [orgs]);
  const userNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    users.forEach((u) => { map[u.id] = u.name; });
    return map;
  }, [users]);

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
        const [eventsData, orgsRes, usersRes] = await Promise.all([
          fetchEvents(),
          fetchOrganizations(),
          fetchUsers(),
        ]);
        setEvents(eventsData);
        setOrgs(orgsRes.map(o => ({ id: o.id, name: o.name })));
        setUsers(usersRes.map(u => ({ id: u.id, name: u.name })));
      } catch { /* backend unavailable */ }
    };
    load();
  }, []);

  const baseOrgIdNum =
    orgFilter != null && orgFilter !== ''
      ? Number(orgFilter)
      : user?.role !== 'SUPER_ADMIN'
        ? user?.organizationId ?? null
        : null;
  const orgEvents =
    baseOrgIdNum != null && Number.isFinite(baseOrgIdNum)
      ? events.filter((e) => e.organizationId === baseOrgIdNum)
      : events;
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

  const handleSaveEdit = (id: number, updates: Partial<DamageEvent>) => {
    updateEvent(id, updates);
    if (selectedEvent?.id === id) {
      setSelectedEvent((prev) => prev ? { ...prev, ...updates } : prev);
    }
  };

  const handleToggleHide = async (id: number) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    try {
      const updated = await patchEventApi(id, { hidden: !ev.hidden });
      updateEvent(id, updated);
      if (selectedEvent?.id === id) setSelectedEvent(updated);
    } catch {
      /* forbidden or network */
    }
  };

  const filterButtons: { label: string; value: FilterStatus; count: number }[] = [
    { label: 'All',         value: 'all',                   count: orgEvents.length },
    { label: 'New',         value: EventStatus.NEW,         count: orgEvents.filter((e) => e.status === EventStatus.NEW).length },
    { label: 'In Progress', value: EventStatus.IN_PROGRESS, count: orgEvents.filter((e) => e.status === EventStatus.IN_PROGRESS).length },
    { label: 'Done',        value: EventStatus.DONE,        count: orgEvents.filter((e) => e.status === EventStatus.DONE).length },
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
            onToggleHide={handleToggleHide}
            onUpdateStatus={async (id, status) => {
              try {
                const updated = await patchEventApi(id, { status });
                updateEvent(id, updated);
                if (selectedEvent?.id === id) setSelectedEvent(updated);
              } catch {
                /* server rejected */
              }
            }}
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
