/**
 * Normalize API JSON (camelCase) to domain types with numeric DB ids.
 */

import { EventStatus } from '../types';
import type {
  DamageEvent,
  EventStatusHistoryEntry,
  Organization,
  User,
  EventStatus as EventStatusType,
  UserRole,
} from '../types';

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseOrganization(raw: Record<string, unknown>): Organization {
  return {
    id: num(raw.id),
    externalId: (raw.externalId as string) ?? null,
    name: String(raw.name ?? ''),
    settlementId: num(raw.settlementId),
    settlement_code: String(raw.settlement_code ?? ''),
    settlementName: raw.settlementName != null ? String(raw.settlementName) : undefined,
    description: raw.description as string | undefined,
    adminId: raw.adminId === undefined || raw.adminId === null ? undefined : num(raw.adminId),
    logoUrl: raw.logoUrl as string | undefined,
    createdAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
    updatedAt: raw.updatedAt ? new Date(String(raw.updatedAt)) : undefined,
    totalEvents: raw.totalEvents as number | undefined,
    totalUsers: raw.totalUsers as number | undefined,
  };
}

/** Map API/legacy status strings to DB-aligned event_status.name values. */
export function parseEventStatus(raw: unknown): EventStatusType {
  const s = String(raw ?? '');
  if (s === 'pending' || s === EventStatus.NEW) return EventStatus.NEW;
  if (s === EventStatus.IN_PROGRESS) return EventStatus.IN_PROGRESS;
  if (s === 'completed' || s === EventStatus.DONE) return EventStatus.DONE;
  return EventStatus.NEW;
}

function parseHistory(raw: unknown): EventStatusHistoryEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((h) => {
    const row = h as Record<string, unknown>;
    return {
      oldStatus: String(row.oldStatus ?? ''),
      newStatus: String(row.newStatus ?? ''),
      changedBy: num(row.changedBy),
      changedByName: String(row.changedByName ?? ''),
      changedAt: String(row.changedAt ?? ''),
    };
  });
}

export function parseUser(raw: Record<string, unknown>): User {
  return {
    id: num(raw.id),
    externalId: (raw.externalId as string) ?? null,
    name: String(raw.name ?? ''),
    email: String(raw.email ?? ''),
    role: raw.role as UserRole,
    roleId: num(raw.roleId),
    organizationId: numOrNull(raw.organizationId),
    jobTitle: raw.jobTitle as string | undefined,
    profileImage: raw.profileImage as string | undefined,
    lastLogin: raw.lastLogin ? new Date(String(raw.lastLogin)) : undefined,
    createdAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
    isActive: raw.isActive !== false,
  };
}

export function parseDamageEvent(raw: Record<string, unknown>): DamageEvent {
  const loc = (raw.location || {}) as Record<string, unknown>;
  const tags = Array.isArray(raw.tags) ? (raw.tags as string[]) : [];
  return {
    id: num(raw.id),
    organizationId: num(raw.organizationId),
    name: raw.name as string | undefined,
    location: {
      lat: num(loc.lat),
      lng: num(loc.lng),
      address: String(loc.address ?? ''),
      city: loc.city as string | undefined,
      postalCode: loc.postalCode as string | undefined,
    },
    imageUrl: String(raw.imageUrl ?? ''),
    imageUrls: raw.imageUrls as string[] | undefined,
    description: String(raw.description ?? ''),
    damageClassification: raw.damageClassification as DamageEvent['damageClassification'],
    damageScore: num(raw.damageScore),
    priorityScore: num(raw.priorityScore),
    gisDetails: raw.gisDetails as DamageEvent['gisDetails'],
    gisStatus: raw.gisStatus as DamageEvent['gisStatus'],
    status: parseEventStatus(raw.status),
    hidden: Boolean(raw.hidden),
    llmExplanation: String(raw.llmExplanation ?? ''),
    aiModel: raw.aiModel as string | undefined,
    createdBy: num(raw.createdBy),
    createdAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
    updatedAt: raw.updatedAt ? new Date(String(raw.updatedAt)) : undefined,
    resolvedAt: raw.resolvedAt ? new Date(String(raw.resolvedAt)) : undefined,
    estimatedRepairCost: raw.estimatedRepairCost as number | undefined,
    assignedTo: raw.assignedTo as string | undefined,
    tags,
    history: parseHistory(raw.history),
  };
}
