import { API_BASE_URL } from '../../config/api';
import { useAuthStore } from '../../store/authStore';

/**
 * Authenticated fetch. Sends Bearer token when present.
 * Does not set Content-Type for FormData bodies.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  options?: { skipAuthRedirect?: boolean }
): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type') &&
    init.body != null &&
    typeof init.body === 'string'
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (
    res.status === 401 &&
    !path.includes('/auth/login') &&
    !options?.skipAuthRedirect
  ) {
    useAuthStore.getState().logoutUser();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?returnUrl=${returnUrl}`);
    }
  }

  return res;
}
