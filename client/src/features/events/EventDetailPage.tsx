import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { EventDetailView } from '../../components/events/EventDetailView';
import { Button } from '../../components/ui/Button';
import { fetchEventById } from '../../api/events';
import type { DamageEvent } from '../../types';

export const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<DamageEvent | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      setError('');
      const id = Number(eventId);
      if (!Number.isFinite(id)) {
        setError('Invalid event id');
        return;
      }
      const data = await fetchEventById(id, { detail: true });
      if (cancelled) return;
      if (!data) {
        setError('Event not found or access denied');
        setEvent(null);
        return;
      }
      setEvent(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <PageContainer title={event?.name ?? `Event #${eventId ?? ''}`}>
      <div className="max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-gray-500 -mt-2 mb-2">
          Full record: images, GIS, analysis, tags, status history
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)} className="inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button variant="secondary" type="button" onClick={() => navigate('/admin/events')}>
            All events
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3">{error}</div>
        )}

        {event && <EventDetailView event={event} />}
      </div>
    </PageContainer>
  );
};
