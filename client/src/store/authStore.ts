import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { UserRole, EventStatus } from '../types';
import type {
  User,
  AuthState,
  DamageEvent,
  Organization,
  DashboardStats,
  Notification,
} from '../types';

interface AuthStoreState extends AuthState {
  organization: Organization | null;
  loginUser: (user: User, organization: Organization) => void;
  logoutUser: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateUserProfile: (updates: Partial<User>) => void;
  hasRole: (...roles: UserRole[]) => boolean;
  canAccessOrganization: (orgId: string) => boolean;
}

interface EventStoreState {
  events: DamageEvent[];
  filteredEvents: DamageEvent[];
  selectedEvent: DamageEvent | null;
  isLoading: boolean;
  error: string | null;

  setEvents: (events: DamageEvent[]) => void;
  setSelectedEvent: (event: DamageEvent | null) => void;
  addEvent: (event: DamageEvent) => void;
  updateEvent: (id: string, updates: Partial<DamageEvent>) => void;
  deleteEvent: (id: string) => void;
  toggleHideEvent: (id: string) => void;
  filterEventsByStatus: (status: EventStatus) => void;
  filterEventsByOrganization: (orgId: string) => void;
  sortEventsByPriority: () => void;
  sortEventsByDate: (order: 'asc' | 'desc') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearFilters: () => void;

  getStats: (currentUser: User) => DashboardStats;
  getOrganizationStats: (orgId: string) => DashboardStats;
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
      user: null,
      organization: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      loginUser: (user: User, organization: Organization) => {
        set({
          user,
          organization,
          isAuthenticated: true,
          error: null,
        });
        localStorage.setItem('auth_user', JSON.stringify(user));
        localStorage.setItem('auth_organization', JSON.stringify(organization));
      },

      logoutUser: () => {
        set({
          user: null,
          organization: null,
          isAuthenticated: false,
          error: null,
        });
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_organization');
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
          localStorage.setItem('auth_user', JSON.stringify(updatedUser));
          return { user: updatedUser };
        });
      },

      hasRole: (...roles: UserRole[]) => {
        const { user } = get();
        return user ? roles.includes(user.role) : false;
      },

      canAccessOrganization: (orgId: string) => {
        const { user } = get();
        if (!user) return false;
        return user.role === UserRole.SUPER_ADMIN || user.organizationId === orgId;
      },
    }),
    {
      name: 'authStore',
    }
  )
);

export const useEventStore = create<EventStoreState>()(
  devtools(
    (set, get) => ({
      events: [],
      filteredEvents: [],
      selectedEvent: null,
      isLoading: false,
      error: null,

      setEvents: (events: DamageEvent[]) => {
        const sorted = [...events].sort((a, b) => b.priorityScore - a.priorityScore);
        set({
          events: sorted,
          filteredEvents: sorted,
        });
      },

      setSelectedEvent: (event: DamageEvent | null) => {
        set({ selectedEvent: event });
      },

      addEvent: (event: DamageEvent) => {
        set((state) => {
          const updated = [event, ...state.events].sort((a, b) => b.priorityScore - a.priorityScore);
          return {
            events: updated,
            filteredEvents: updated,
          };
        });
      },

      updateEvent: (id: string, updates: Partial<DamageEvent>) => {
        set((state) => {
          const updated = state.events
            .map((e) => (e.id === id ? { ...e, ...updates } : e))
            .sort((a, b) => b.priorityScore - a.priorityScore);
          const filtered = state.filteredEvents
            .map((e) => (e.id === id ? { ...e, ...updates } : e))
            .sort((a, b) => b.priorityScore - a.priorityScore);
          return {
            events: updated,
            filteredEvents: filtered,
            selectedEvent:
              state.selectedEvent?.id === id
                ? { ...state.selectedEvent, ...updates }
                : state.selectedEvent,
          };
        });
      },

      deleteEvent: (id: string) => {
        set((state) => {
          const updated = state.events.filter((e) => e.id !== id);
          const filtered = state.filteredEvents.filter((e) => e.id !== id);
          return {
            events: updated,
            filteredEvents: filtered,
            selectedEvent:
              state.selectedEvent?.id === id ? null : state.selectedEvent,
          };
        });
      },

      toggleHideEvent: (id: string) => {
        set((state) => {
          const updated = state.events.map((e) =>
            e.id === id ? { ...e, hidden: !e.hidden } : e
          );
          const filtered = state.filteredEvents.map((e) =>
            e.id === id ? { ...e, hidden: !e.hidden } : e
          );
          return { events: updated, filteredEvents: filtered };
        });
      },

      filterEventsByStatus: (status: EventStatus) => {
        set((state) => ({
          filteredEvents: state.events
            .filter((e) => e.status === status)
            .sort((a, b) => b.priorityScore - a.priorityScore),
        }));
      },

      filterEventsByOrganization: (orgId: string) => {
        set((state) => ({
          filteredEvents: state.events
            .filter((e) => e.organizationId === orgId)
            .sort((a, b) => b.priorityScore - a.priorityScore),
        }));
      },

      sortEventsByPriority: () => {
        set((state) => ({
          filteredEvents: [...state.filteredEvents].sort(
            (a, b) => b.priorityScore - a.priorityScore
          ),
        }));
      },

      sortEventsByDate: (order: 'asc' | 'desc') => {
        set((state) => ({
          filteredEvents: [...state.filteredEvents].sort((a, b) => {
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return order === 'asc' ? timeA - timeB : timeB - timeA;
          }),
        }));
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearFilters: () => {
        set((state) => ({
          filteredEvents: [...state.events].sort((a, b) => b.priorityScore - a.priorityScore),
        }));
      },

      getStats: (currentUser: User): DashboardStats => {
        const { events } = get();
        const userEvents =
          currentUser.role === UserRole.SUPER_ADMIN
            ? events
            : events.filter((e) => e.organizationId === currentUser.organizationId);

        const pendingEvents = userEvents.filter((e) => e.status === EventStatus.PENDING);
        const inProgressEvents = userEvents.filter((e) => e.status === EventStatus.IN_PROGRESS);
        const completedEvents = userEvents.filter((e) => e.status === EventStatus.COMPLETED);

        const avgDamageScore =
          userEvents.length > 0
            ? Math.round((userEvents.reduce((sum, e) => sum + e.damageScore, 0) / userEvents.length) * 10) / 10
            : 0;

        const avgPriorityScore =
          userEvents.length > 0
            ? Math.round((userEvents.reduce((sum, e) => sum + e.priorityScore, 0) / userEvents.length) * 10) / 10
            : 0;

        return {
          totalEvents: userEvents.length,
          pendingEvents: pendingEvents.length,
          inProgressEvents: inProgressEvents.length,
          completedEvents: completedEvents.length,
          averageDamageScore: avgDamageScore,
          averagePriorityScore: avgPriorityScore,
          highPriorityCount: userEvents.filter((e) => e.priorityScore >= 7.5).length,
          mediumPriorityCount: userEvents.filter((e) => e.priorityScore >= 5.0 && e.priorityScore < 7.5).length,
          lowPriorityCount: userEvents.filter((e) => e.priorityScore < 5.0).length,
        };
      },

      getOrganizationStats: (orgId: string): DashboardStats => {
        const { events } = get();
        const orgEvents = events.filter((e) => e.organizationId === orgId);

        const pendingEvents = orgEvents.filter((e) => e.status === EventStatus.PENDING);
        const inProgressEvents = orgEvents.filter((e) => e.status === EventStatus.IN_PROGRESS);
        const completedEvents = orgEvents.filter((e) => e.status === EventStatus.COMPLETED);

        const avgDamageScore =
          orgEvents.length > 0
            ? Math.round((orgEvents.reduce((sum, e) => sum + e.damageScore, 0) / orgEvents.length) * 10) / 10
            : 0;

        const avgPriorityScore =
          orgEvents.length > 0
            ? Math.round((orgEvents.reduce((sum, e) => sum + e.priorityScore, 0) / orgEvents.length) * 10) / 10
            : 0;

        return {
          totalEvents: orgEvents.length,
          pendingEvents: pendingEvents.length,
          inProgressEvents: inProgressEvents.length,
          completedEvents: completedEvents.length,
          averageDamageScore: avgDamageScore,
          averagePriorityScore: avgPriorityScore,
          highPriorityCount: orgEvents.filter((e) => e.priorityScore >= 7.5).length,
          mediumPriorityCount: orgEvents.filter((e) => e.priorityScore >= 5.0 && e.priorityScore < 7.5).length,
          lowPriorityCount: orgEvents.filter((e) => e.priorityScore < 5.0).length,
        };
      },
    }),
    {
      name: 'eventStore',
    }
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