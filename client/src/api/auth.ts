import { API_BASE_URL } from '../config/api';
import { parseUser } from './parsers';
import type { User } from '../types';

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE_URL}/auth/users`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map((u: Record<string, unknown>) => parseUser(u));
}
