import { apiFetch } from '../shared/api/http';
import { parseDamageEvent } from './parsers';
import type { DamageEvent, EventStatus } from '../types';

export async function fetchEvents(): Promise<DamageEvent[]> {
  const res = await apiFetch('/events');
  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map((e: Record<string, unknown>) => parseDamageEvent(e));
}

export async function fetchEventById(
  id: number,
  options?: { detail?: boolean }
): Promise<DamageEvent | null> {
  const q = options?.detail ? '?detail=true' : '';
  const res = await apiFetch(`/events/${id}${q}`);
  if (!res.ok) return null;
  const data = await res.json();
  return parseDamageEvent(data as Record<string, unknown>);
}

export async function patchEventApi(
  id: number,
  body: { status?: EventStatus; hidden?: boolean }
): Promise<DamageEvent> {
  const payload: { status?: string; hidden?: boolean } = {};
  if (body.status !== undefined) payload.status = body.status;
  if (body.hidden !== undefined) payload.hidden = body.hidden;
  const res = await apiFetch(`/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail;
    throw new Error(typeof detail === 'string' ? detail : `Update failed (${res.status})`);
  }
  return parseDamageEvent(data as Record<string, unknown>);
}
