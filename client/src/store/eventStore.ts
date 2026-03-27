import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { UserRole, EventStatus } from '../types';
import type { User, DamageEvent, DashboardStats } from '../types';

interface EventStoreState {
  events: DamageEvent[];
  filteredEvents: DamageEvent[];
  selectedEvent: DamageEvent | null;
  isLoading: boolean;
  error: string | null;

  setEvents: (events: DamageEvent[]) => void;
  setSelectedEvent: (event: DamageEvent | null) => void;
  addEvent: (event: DamageEvent) => void;
  updateEvent: (id: number, updates: Partial<DamageEvent>) => void;
  deleteEvent: (id: number) => void;
  toggleHideEvent: (id: number) => void;
  filterEventsByStatus: (status: EventStatus) => void;
  filterEventsByOrganization: (orgId: number) => void;
  sortEventsByPriority: () => void;
  sortEventsByDate: (order: 'asc' | 'desc') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearFilters: () => void;

  getStats: (currentUser: User) => DashboardStats;
  getOrganizationStats: (orgId: number) => DashboardStats;
}

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

      updateEvent: (id: number, updates: Partial<DamageEvent>) => {
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

      deleteEvent: (id: number) => {
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

      toggleHideEvent: (id: number) => {
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

      filterEventsByOrganization: (orgId: number) => {
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

        const newEvents = userEvents.filter((e) => e.status === EventStatus.NEW);
        const inProgressEvents = userEvents.filter((e) => e.status === EventStatus.IN_PROGRESS);
        const doneEvents = userEvents.filter((e) => e.status === EventStatus.DONE);

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
          pendingEvents: newEvents.length,
          inProgressEvents: inProgressEvents.length,
          completedEvents: doneEvents.length,
          averageDamageScore: avgDamageScore,
          averagePriorityScore: avgPriorityScore,
          highPriorityCount: userEvents.filter((e) => e.priorityScore >= 7.5).length,
          mediumPriorityCount: userEvents.filter((e) => e.priorityScore >= 5.0 && e.priorityScore < 7.5).length,
          lowPriorityCount: userEvents.filter((e) => e.priorityScore < 5.0).length,
        };
      },

      getOrganizationStats: (orgId: number): DashboardStats => {
        const { events } = get();
        const orgEvents = events.filter((e) => e.organizationId === orgId);

        const newEvents = orgEvents.filter((e) => e.status === EventStatus.NEW);
        const inProgressEvents = orgEvents.filter((e) => e.status === EventStatus.IN_PROGRESS);
        const doneEvents = orgEvents.filter((e) => e.status === EventStatus.DONE);

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
          pendingEvents: newEvents.length,
          inProgressEvents: inProgressEvents.length,
          completedEvents: doneEvents.length,
          averageDamageScore: avgDamageScore,
          averagePriorityScore: avgPriorityScore,
          highPriorityCount: orgEvents.filter((e) => e.priorityScore >= 7.5).length,
          mediumPriorityCount: orgEvents.filter((e) => e.priorityScore >= 5.0 && e.priorityScore < 7.5).length,
          lowPriorityCount: orgEvents.filter((e) => e.priorityScore < 5.0).length,
        };
      },
    }),
    { name: 'eventStore' }
  )
);
