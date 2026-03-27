import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { UserRole } from '../types';
import type { User, AuthState, Organization, Notification } from '../types';

const LS_USER = 'auth_user';
const LS_ORG = 'auth_organization';
const LS_TOKEN = 'auth_token';

function readPersistedAuth(): {
  user: User | null;
  organization: Organization | null;
  accessToken: string | null;
  isAuthenticated: boolean;
} {
  if (typeof window === 'undefined') {
    return { user: null, organization: null, accessToken: null, isAuthenticated: false };
  }
  try {
    const tu = localStorage.getItem(LS_USER);
    const to = localStorage.getItem(LS_ORG);
    const tt = localStorage.getItem(LS_TOKEN);
    if (!tu || !to || !tt) {
      return { user: null, organization: null, accessToken: null, isAuthenticated: false };
    }
    return {
      user: JSON.parse(tu) as User,
      organization: JSON.parse(to) as Organization,
      accessToken: tt,
      isAuthenticated: true,
    };
  } catch {
    return { user: null, organization: null, accessToken: null, isAuthenticated: false };
  }
}

const persisted = readPersistedAuth();

interface AuthStoreState extends AuthState {
  organization: Organization | null;
  accessToken: string | null;
  loginUser: (user: User, organization: Organization, accessToken: string) => void;
  setSession: (user: User, organization: Organization, accessToken: string) => void;
  logoutUser: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateUserProfile: (updates: Partial<User>) => void;
  hasRole: (...roles: UserRole[]) => boolean;
  canAccessOrganization: (orgId: number) => boolean;
}

interface NotificationStoreState {
  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  unreadCount: () => number;
}

export const useAuthStore = create<AuthStoreState>()(
  devtools(
    (set, get) => ({
      user: persisted.user,
      organization: persisted.organization,
      accessToken: persisted.accessToken,
      isAuthenticated: persisted.isAuthenticated,
      isLoading: false,
      error: null,

      loginUser: (user: User, organization: Organization, accessToken: string) => {
        set({
          user,
          organization,
          accessToken,
          isAuthenticated: true,
          error: null,
        });
        localStorage.setItem(LS_USER, JSON.stringify(user));
        localStorage.setItem(LS_ORG, JSON.stringify(organization));
        localStorage.setItem(LS_TOKEN, accessToken);
      },

      setSession: (user: User, organization: Organization, accessToken: string) => {
        set({
          user,
          organization,
          accessToken,
          isAuthenticated: true,
          error: null,
        });
        localStorage.setItem(LS_USER, JSON.stringify(user));
        localStorage.setItem(LS_ORG, JSON.stringify(organization));
        localStorage.setItem(LS_TOKEN, accessToken);
      },

      logoutUser: () => {
        set({
          user: null,
          organization: null,
          accessToken: null,
          isAuthenticated: false,
          error: null,
        });
        localStorage.removeItem(LS_USER);
        localStorage.removeItem(LS_ORG);
        localStorage.removeItem(LS_TOKEN);
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      updateUserProfile: (updates: Partial<User>) => {
        set((state) => {
          if (!state.user) return state;
          const updatedUser = { ...state.user, ...updates };
          localStorage.setItem(LS_USER, JSON.stringify(updatedUser));
          return { user: updatedUser };
        });
      },

      hasRole: (...roles: UserRole[]) => {
        const { user } = get();
        return user ? roles.includes(user.role) : false;
      },

      canAccessOrganization: (orgId: number) => {
        const { user } = get();
        if (!user) return false;
        return user.role === UserRole.SUPER_ADMIN || user.organizationId === orgId;
      },
    }),
    { name: 'authStore' }
  )
);

export const useNotificationStore = create<NotificationStoreState>()(
  devtools(
    (set, get) => ({
      notifications: [],

      setNotifications: (notifications: Notification[]) => {
        set({ notifications });
      },

      addNotification: (notification: Notification) => {
        set((state) => ({
          notifications: [notification, ...state.notifications],
        }));
      },

      markAsRead: (id: string) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      unreadCount: () => {
        return get().notifications.filter((n) => !n.read).length;
      },
    }),
    { name: 'notificationStore' }
  )
);
