import { API_BASE_URL } from '../config/api';
import { parseDamageEvent } from './parsers';
import type { DamageEvent } from '../types';

export async function fetchEvents(): Promise<DamageEvent[]> {
  const res = await fetch(`${API_BASE_URL}/events`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map((e: Record<string, unknown>) => parseDamageEvent(e));
}
