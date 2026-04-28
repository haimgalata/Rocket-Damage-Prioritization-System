import { EventStatus } from '../types';
import type { DamageEvent, DashboardStats } from '../types';

export const getStatusLabel = (status: EventStatus): string => {
  switch (status) {
    case EventStatus.NEW:         return 'New';
    case EventStatus.IN_PROGRESS: return 'In Progress';
    case EventStatus.DONE:        return 'Done';
    default:                      return status;
  }
};

export const getStatusColor = (status: EventStatus): string => {
  switch (status) {
    case EventStatus.NEW:
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case EventStatus.IN_PROGRESS:
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case EventStatus.DONE:
      return 'bg-green-100 text-green-800 border-green-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export const getStatusBgColor = (status: EventStatus): string => {
  switch (status) {
    case EventStatus.NEW:
      return 'bg-yellow-50';
    case EventStatus.IN_PROGRESS:
      return 'bg-blue-50';
    case EventStatus.DONE:
      return 'bg-green-50';
    default:
      return 'bg-gray-50';
  }
};

export const getPriorityColor = (score: number): string => {
  if (score >= 7.5) return 'bg-red-100 text-red-800 border-red-300';
  if (score >= 5.0) return 'bg-orange-100 text-orange-800 border-orange-300';
  if (score >= 2.5) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return 'bg-green-100 text-green-800 border-green-300';
};

export const getPriorityTextColor = (score: number): string => {
  if (score >= 7.5) return 'text-red-600';
  if (score >= 5.0) return 'text-orange-600';
  if (score >= 2.5) return 'text-yellow-600';
  return 'text-green-600';
};

export const getPriorityLabel = (score: number): string => {
  if (score >= 7.5) return 'Critical';
  if (score >= 5.0) return 'High';
  if (score >= 2.5) return 'Medium';
  return 'Low';
};

export const getMarkerColor = (score: number): string => {
  if (score >= 7.5) return '#dc2626';
  if (score >= 5.0) return '#f97316';
  return '#16a34a';
};

export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTimeAgo = (date: Date | string): string => {
  const d = new Date(date);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(d);
};

export const truncateText = (text: string, length: number = 100): string => {
  return text.length > length ? text.substring(0, length) + '...' : text;
};

export const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const formatRole = (role: string): string => {
  if (role === 'SUPER_ADMIN') return 'Technical Team';
  return role
    .split('_')
    .map((word) => capitalizeFirstLetter(word.toLowerCase()))
    .join(' ');
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const formatScore = (score: number): string => {
  return `${Number(score).toFixed(1)}/10`;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

export const formatAddress = (
  address: string,
  city?: string,
  postalCode?: string
): string => {
  const parts = [address, city, postalCode].filter(Boolean);
  return parts.join(', ');
};

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 100) / 100;
};

export const sortEventsByPriority = (events: DamageEvent[]): DamageEvent[] => {
  return [...events].sort((a, b) => b.priorityScore - a.priorityScore);
};

export const sortEventsByDate = (
  events: DamageEvent[],
  order: 'asc' | 'desc' = 'desc'
): DamageEvent[] => {
  return [...events].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return order === 'asc' ? timeA - timeB : timeB - timeA;
  });
};

export const filterEventsByStatus = (
  events: DamageEvent[],
  status: EventStatus
): DamageEvent[] => {
  return events.filter((e) => e.status === status);
};

export const groupEventsByStatus = (
  events: DamageEvent[]
): Record<EventStatus, DamageEvent[]> => {
  return {
    [EventStatus.NEW]: events.filter((e) => e.status === EventStatus.NEW),
    [EventStatus.IN_PROGRESS]: events.filter(
      (e) => e.status === EventStatus.IN_PROGRESS
    ),
    [EventStatus.DONE]: events.filter((e) => e.status === EventStatus.DONE),
  };
};

export const calculateEventStats = (events: DamageEvent[]): DashboardStats => {
  const pending = events.filter((e) => e.status === EventStatus.NEW);
  const inProgress = events.filter((e) => e.status === EventStatus.IN_PROGRESS);
  const completed = events.filter((e) => e.status === EventStatus.DONE);

  const avgDamage =
    events.length > 0
      ? Math.round(events.reduce((sum, e) => sum + e.damageScore, 0) / events.length)
      : 0;
  const avgPriority =
    events.length > 0
      ? Math.round(events.reduce((sum, e) => sum + e.priorityScore, 0) / events.length)
      : 0;

  return {
    totalEvents: events.length,
    pendingEvents: pending.length,
    inProgressEvents: inProgress.length,
    completedEvents: completed.length,
    averageDamageScore: avgDamage,
    averagePriorityScore: avgPriority,
    highPriorityCount: events.filter((e) => e.priorityScore >= 7.5).length,
    mediumPriorityCount: events.filter(
      (e) => e.priorityScore >= 5.0 && e.priorityScore < 7.5
    ).length,
    lowPriorityCount: events.filter((e) => e.priorityScore < 5.0).length,
  };
};

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isValidCoordinates = (lat: number, lng: number): boolean => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

export default {
  getStatusColor,
  getStatusBgColor,
  getPriorityColor,
  getPriorityTextColor,
  getPriorityLabel,
  getMarkerColor,
  formatDate,
  formatDateTime,
  formatTimeAgo,
  truncateText,
  capitalizeFirstLetter,
  formatRole,
  getInitials,
  formatScore,
  formatCurrency,
  formatNumber,
  formatAddress,
  calculateDistance,
  sortEventsByPriority,
  sortEventsByDate,
  filterEventsByStatus,
  groupEventsByStatus,
  calculateEventStats,
  isValidEmail,
  isValidCoordinates,
};
