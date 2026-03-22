import { API_BASE_URL } from '../config/api';
import { parseOrganization } from './parsers';
import type { Organization } from '../types';

export type SettlementOption = {
  id: number;
  name: string;
  settlement_code: string;
};

export async function fetchOrganizations(): Promise<Organization[]> {
  const res = await fetch(`${API_BASE_URL}/organizations`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map((o: Record<string, unknown>) => parseOrganization(o));
}

export async function fetchSettlements(): Promise<SettlementOption[]> {
  const res = await fetch(`${API_BASE_URL}/settlements`);
  if (!res.ok) return [];
  return res.json();
}

export type CreateOrganizationPayload = {
  name: string;
  settlement_id: number;
  assign_admin_external_id?: string | null;
};

export async function createOrganization(
  payload: CreateOrganizationPayload
): Promise<Organization> {
  const res = await fetch(`${API_BASE_URL}/organizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      settlement_id: payload.settlement_id,
      assign_admin_external_id: payload.assign_admin_external_id || null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data.detail === 'string'
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((d: { msg?: string }) => d.msg).join(', ')
          : 'Failed to create organization';
    throw new Error(msg);
  }
  return parseOrganization(data as Record<string, unknown>);
}
