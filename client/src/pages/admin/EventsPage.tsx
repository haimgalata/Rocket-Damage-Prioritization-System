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
import { useNotificationStore } from '../../store/authStore';
import { patchEventApi, deleteEventApi } from '../../api/events';
import { useAuth } from '../../hooks';
import { fetchOrganizations } from '../../api/organizations';
import { fetchUsers } from '../../api/auth';
import { EventStatus, UserRole } from '../../types';
import type { DamageEvent } from '../../types';
import { fetchEvents } from '../../api/events';
import { getStatusLabel } from '../../utils/helpers';

type MapMode    = 'pins' | 'heatmap';
type FilterStatus = 'all' | EventStatus;

export const EventsPage: React.FC = () => {
  const { user } = useAuth();
  const { events, setEvents, updateEvent, deleteEvent } = useEventStore();
  const { addNotification } = useNotificationStore();
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
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) {
      const ev = events.find((e) => e.id === id);
      addNotification({
        id: `edit-${Date.now()}`,
        title: 'פרטי אירוע עודכנו',
        message: `אירוע "${ev?.name ?? `#${id}`}" עודכן בהצלחה.`,
        type: 'info',
        read: false,
        createdAt: new Date(),
        eventId: id,
      });
    }
  };

  const handleDeleteEvent = async (event: DamageEvent) => {
    try {
      await deleteEventApi(event.id);
      deleteEvent(event.id);
      if (selectedEvent?.id === event.id) {
        setSelectedEvent(null);
        setIsDetailOpen(false);
      }
      addNotification({
        id: `delete-${Date.now()}`,
        title: 'אירוע נמחק',
        message: `אירוע "${event.name ?? `#${event.id}`}" נמחק בהצלחה.`,
        type: 'info',
        read: false,
        createdAt: new Date(),
        eventId: event.id,
      });
    } catch {
      /* forbidden or network */
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
    { label: 'הכל',    value: 'all',                   count: orgEvents.length },
    { label: 'חדש',    value: EventStatus.NEW,         count: orgEvents.filter((e) => e.status === EventStatus.NEW).length },
    { label: 'בטיפול', value: EventStatus.IN_PROGRESS, count: orgEvents.filter((e) => e.status === EventStatus.IN_PROGRESS).length },
    { label: 'הושלם',  value: EventStatus.DONE,        count: orgEvents.filter((e) => e.status === EventStatus.DONE).length },
  ];

  return (
    <PageContainer title="אירועים">
      <div className="max-w-[1400px] mx-auto space-y-6">

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 shadow-sm">
            {filterButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setFilterStatus(btn.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  filterStatus === btn.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {btn.label}
                <span className={`mr-1.5 text-xs ${filterStatus === btn.value ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
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
              <X className="w-4 h-4" /> נקה סינון
            </button>
          )}
        </div>

        <Card
          title="תצוגת מפה"
          subtitle={mapMode === 'pins' ? '' : 'מפת חום נזקים'}
          noPadding
          headerRight={
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setMapMode('pins')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${mapMode === 'pins' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Map className="w-3.5 h-3.5" /> סיכות
              </button>
              <button
                onClick={() => setMapMode('heatmap')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${mapMode === 'heatmap' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Layers className="w-3.5 h-3.5" /> מפת חום
              </button>
            </div>
          }
        >
          <div className="p-2 sm:p-4">
            <div className="h-[220px] sm:h-[320px] lg:h-[460px]">
              <EventMap
                events={orgEvents.filter((e) => !e.hidden)}
                height="100%"
                onEventClick={handleSelectEvent}
                mode={mapMode}
                focusEvent={mapFocusEvent}
              />
            </div>
            {mapMode === 'pins' && (
              <div className="flex items-center gap-4 mt-3">
                {[
                  { color: 'bg-red-500',    label: 'קריטי (≥7.5)'       },
                  { color: 'bg-orange-500', label: 'גבוה (5–7.4)'      },
                  { color: 'bg-green-500',  label: 'נמוך–בינוני (<5)'  },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${color}`} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card
          title="רשימת אירועים"
          noPadding
          headerRight={
            <button
              onClick={() => setShowHidden((v) => !v)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline cursor-pointer"
            >
              {showHidden ? 'הסתר מוסתרים' : 'הצג מוסתרים'}
            </button>
          }
        >
          <EventTable
            events={displayEvents}
            onSelectEvent={handleSelectEvent}
            onEditEvent={handleEditEvent}
            onToggleHide={handleToggleHide}
            onDeleteEvent={handleDeleteEvent}
            onUpdateStatus={async (id, status) => {
              try {
                const updated = await patchEventApi(id, { status });
                updateEvent(id, updated);
                if (selectedEvent?.id === id) setSelectedEvent(updated);
                if (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) {
                  addNotification({
                    id: `status-${Date.now()}`,
                    title: 'סטטוס אירוע השתנה',
                    message: `אירוע "${updated.name ?? `#${id}`}" הועבר לסטטוס: ${getStatusLabel(status)}.`,
                    type: 'info',
                    read: false,
                    createdAt: new Date(),
                    eventId: id,
                  });
                }
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
        title={selectedEvent?.name ?? 'פרטי אירוע'}
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
