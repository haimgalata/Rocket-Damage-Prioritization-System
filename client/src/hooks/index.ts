import { useAuthStore } from '../store/authStore';
import { useEventStore } from '../store/eventStore';
import { UserRole } from '../types';

export const useAuth = () => {
  const {
    user,
    organization,
    isAuthenticated,
    isLoading,
    error,
    loginUser,
    setSession,
    logoutUser,
    setLoading,
    setError,
    updateUserProfile,
    hasRole,
    canAccessOrganization,
  } = useAuthStore();

  return {
    user,
    organization,
    isAuthenticated,
    isLoading,
    error,
    loginUser,
    setSession,
    logoutUser,
    logout: logoutUser,
    setLoading,
    setError,
    updateUserProfile,
    hasRole,
    canAccessOrganization,
    isSuperAdmin: () => hasRole(UserRole.SUPER_ADMIN),
    isAdmin: () => hasRole(UserRole.ADMIN),
    isOperator: () => hasRole(UserRole.OPERATOR),
    isAdmin_or_SuperAdmin: () => hasRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  };
};

export const useEvents = () => {
  const {
    events,
    filteredEvents,
    selectedEvent,
    isLoading,
    error,
    setEvents,
    setSelectedEvent,
    addEvent,
    updateEvent,
    deleteEvent,
    toggleHideEvent,
    filterEventsByStatus,
    filterEventsByOrganization,
    sortEventsByPriority,
    sortEventsByDate,
    setLoading,
    setError,
    clearFilters,
    getStats,
    getOrganizationStats,
  } = useEventStore();

  return {
    events,
    filteredEvents,
    selectedEvent,
    isLoading,
    error,
    setEvents,
    setSelectedEvent,
    addEvent,
    updateEvent,
    deleteEvent,
    toggleHideEvent,
    filterEventsByStatus,
    filterEventsByOrganization,
    sortEventsByPriority,
    sortEventsByDate,
    setLoading,
    setError,
    clearFilters,
    getStats,
    getOrganizationStats,
  };
};

export default { useAuth, useEvents };
