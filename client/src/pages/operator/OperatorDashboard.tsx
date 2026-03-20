import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Activity, Clock, CheckCircle2 } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { EventTable } from '../../components/events/EventTable';
import { EditEventModal } from '../../components/events/EditEventModal';
import { EventMap } from '../../components/maps/MapContainer';
import { EventDetailView } from '../../components/events/EventDetailView';
import { useEventStore } from '../../store/authStore';
import { useAuth } from '../../hooks';
import { MOCK_EVENTS, MOCK_USERS } from '../../data/mockData';
import { EventStatus } from '../../types';
import type { DamageEvent } from '../../types';
import { API_BASE_URL } from '../../config/api';

export const OperatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { events, setEvents, updateEvent } = useEventStore();

  const [selectedEvent, setSelectedEvent] = useState<DamageEvent | null>(null);
  const [editingEvent,  setEditingEvent]  = useState<DamageEvent | null>(null);
  const [isDetailOpen,  setIsDetailOpen]  = useState(false);
  const [isEditOpen,    setIsEditOpen]    = useState(false);
  const [mapFocusEvent, setMapFocusEvent] = useState<DamageEvent | null>(null);

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

  const orgEvents = events.filter(
    (e) => e.organizationId === user?.organizationId && !e.hidden,
  );

  const total      = orgEvents.length;
  const pending    = orgEvents.filter((e) => e.status === EventStatus.PENDING).length;
  const inProgress = orgEvents.filter((e) => e.status === EventStatus.IN_PROGRESS).length;
  const completed  = orgEvents.filter((e) => e.status === EventStatus.COMPLETED).length;
  const critical   = orgEvents.filter((e) => e.priorityScore >= 7.5).length;

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

  return (
    <PageContainer title="My Organization — Dashboard">
      <div className="max-w-[1200px] mx-auto space-y-6">

        {critical > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">
              <span className="font-semibold">{critical} critical event{critical !== 1 ? 's' : ''}</span>
              {' '}require immediate attention in your area.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Events', value: total,      icon: <Activity className="w-5 h-5 text-blue-600" />,       bg: 'bg-blue-100'   },
            { label: 'Pending',      value: pending,    icon: <Clock className="w-5 h-5 text-yellow-600" />,       bg: 'bg-yellow-100' },
            { label: 'In Progress',  value: inProgress, icon: <Activity className="w-5 h-5 text-indigo-600" />,    bg: 'bg-indigo-100' },
            { label: 'Completed',    value: completed,  icon: <CheckCircle2 className="w-5 h-5 text-green-600" />, bg: 'bg-green-100'  },
          ].map(({ label, value, icon, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>{icon}</div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        <Card title="Event Map" subtitle="Color-coded by priority · click a marker for details" noPadding>
          <div className="p-4">
            <EventMap
              events={orgEvents}
              height="420px"
              onEventClick={handleSelectEvent}
              mode="pins"
              focusEvent={mapFocusEvent}
            />
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
          </div>
        </Card>

        <Card
          title="Events"
          subtitle={`${orgEvents.length} events in your organization · sorted by priority`}
          noPadding
        >
          <EventTable
            events={orgEvents}
            onSelectEvent={handleSelectEvent}
            onEditEvent={handleEditEvent}
            selectedEventId={selectedEvent?.id}
            compact
            currentUserId={user?.id}
            currentUserRole={user?.role}
            userNameMap={userNameMap}
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
