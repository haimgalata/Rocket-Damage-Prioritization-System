import React, { useState, useEffect } from 'react';
import { List, MapIcon, AlertTriangle } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { EventMap } from '../../components/maps/MapContainer';
import { EventDetailView } from '../../components/events/EventDetailView';
import { EventTable } from '../../components/events/EventTable';
import { useEventStore } from '../../store/authStore';
import { useAuth } from '../../hooks';
import { MOCK_EVENTS } from '../../data/mockData';
import { EventStatus } from '../../types';
import type { DamageEvent } from '../../types';

export const FieldMapView: React.FC = () => {
  const { user } = useAuth();
  const { events, setEvents } = useEventStore();
  const [selectedEvent, setSelectedEvent] = useState<DamageEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'map' | 'list'>('map');

  useEffect(() => {
    if (events.length === 0) setEvents(MOCK_EVENTS);
  }, []);

  const orgEvents = events.filter((e) => e.organizationId === user?.organizationId);
  const criticalEvents = orgEvents.filter((e) => e.priorityScore >= 7.5 && e.status !== EventStatus.COMPLETED);

  const handleSelectEvent = (event: DamageEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  return (
    <PageContainer title="Field Map View">
      <div className="max-w-6xl mx-auto space-y-4">
        {criticalEvents.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">
              <span className="font-semibold">{criticalEvents.length} critical event{criticalEvents.length !== 1 ? 's' : ''}</span>
              {' '}require immediate attention in your area.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{orgEvents.length} events in your organization</p>
          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MapIcon className="w-4 h-4" /> Map
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-4 h-4" /> List
            </button>
          </div>
        </div>

        {view === 'map' ? (
          <Card title="Event Map" subtitle="Click a marker for details" noPadding>
            <div className="p-4">
              <EventMap
                events={orgEvents}
                height="520px"
                onEventClick={handleSelectEvent}
              />
              <div className="flex flex-wrap items-center gap-4 mt-3">
                {[
                  { color: 'bg-red-500', label: 'Critical (≥7.5)', count: orgEvents.filter((e) => e.priorityScore >= 7.5).length },
                  { color: 'bg-orange-500', label: 'High (5–7.4)', count: orgEvents.filter((e) => e.priorityScore >= 5.0 && e.priorityScore < 7.5).length },
                  { color: 'bg-green-500', label: 'Low–Med (<5)', count: orgEvents.filter((e) => e.priorityScore < 5.0).length },
                ].map(({ color, label, count }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${color}`} />
                    <span className="text-xs text-gray-500">{label} ({count})</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : (
          <Card title="All Events" noPadding>
            <EventTable events={orgEvents} onSelectEvent={handleSelectEvent} selectedEventId={selectedEvent?.id} />
          </Card>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedEvent ? selectedEvent.name : 'Event Detail'}
        size="lg"
      >
        {selectedEvent && <EventDetailView event={selectedEvent} />}
      </Modal>
    </PageContainer>
  );
};
