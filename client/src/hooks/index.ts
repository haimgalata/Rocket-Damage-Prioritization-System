/**
 * Custom Hooks
 * useAuth and useEvents hooks for easy access to global state
 */

import { useAuthStore, useEventStore } from '../store/authStore';
import { UserRole } from '../types';

// ============================================================================
// USE AUTH HOOK
// ============================================================================

export const useAuth = () => {
  const {
    user,
    organization,
    isAuthenticated,
    isLoading,
    error,
    loginUser,
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
    logoutUser,
    logout: logoutUser, // alias
    setLoading,
    setError,
    updateUserProfile,
    hasRole,
    canAccessOrganization,
    // Utility methods
    isSuperAdmin: () => hasRole(UserRole.SUPER_ADMIN),
    isAdmin: () => hasRole(UserRole.ADMIN),
    isOperator: () => hasRole(UserRole.OPERATOR),
    isAdmin_or_SuperAdmin: () => hasRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  };
};

// ============================================================================
// USE EVENTS HOOK
// ============================================================================

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