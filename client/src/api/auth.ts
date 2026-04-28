import { API_BASE_URL } from '../config/api';
import { apiFetch } from '../shared/api/http';
import { parseOrganization, parseUser } from './parsers';
import type { Organization, User, UserRole } from '../types';

export async function loginRequest(
  email: string,
  password: string
): Promise<{ accessToken: string; user: User; organization: Organization }> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail = data.detail;
    const msg =
      typeof detail === 'string'
        ? detail
        : 'Invalid credentials';
    throw new Error(msg);
  }
  const orgRaw = data.organization as Record<string, unknown> | undefined;
  const org: Organization =
    orgRaw && orgRaw.id != null && Number(orgRaw.id) > 0
      ? parseOrganization(orgRaw)
      : {
          id: 0,
          name: '',
          settlementId: 0,
          settlement_code: '',
          createdAt: new Date(),
        };
  return {
    accessToken: String(data.access_token ?? ''),
    user: parseUser(data.user as Record<string, unknown>),
    organization: org,
  };
}

export async function fetchAuthMe(): Promise<{
  accessToken: string;
  user: User;
  organization: Organization;
} | null> {
  const res = await apiFetch('/auth/me', {}, { skipAuthRedirect: true });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const orgRaw = data.organization as Record<string, unknown> | undefined;
  const org: Organization =
    orgRaw && orgRaw.id != null && Number(orgRaw.id) > 0
      ? parseOrganization(orgRaw)
      : {
          id: 0,
          name: '',
          settlementId: 0,
          settlement_code: '',
          createdAt: new Date(),
        };
  return {
    accessToken: String(data.access_token ?? ''),
    user: parseUser(data.user as Record<string, unknown>),
    organization: org,
  };
}

export async function fetchUsers(): Promise<User[]> {
  const res = await apiFetch('/auth/users');
  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map((u: Record<string, unknown>) => parseUser(u));
}

export async function changePasswordApi(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const res = await apiFetch('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail;
    throw new Error(typeof detail === 'string' ? detail : 'Failed to change password');
  }
}

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationId: number;
};

export async function patchUserStatusApi(userId: number, isActive: boolean): Promise<User> {
  const res = await apiFetch(`/auth/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail;
    throw new Error(typeof detail === 'string' ? detail : 'Failed to update user status');
  }
  return parseUser(data as Record<string, unknown>);
}

export async function createUserApi(payload: CreateUserPayload): Promise<User> {
  const res = await apiFetch('/auth/users', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      role: payload.role,
      organizationId: payload.organizationId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail;
    throw new Error(typeof detail === 'string' ? detail : 'Failed to create user');
  }
  return parseUser(data as Record<string, unknown>);
}
