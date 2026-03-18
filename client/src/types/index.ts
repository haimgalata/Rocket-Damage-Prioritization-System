/**
 * Core Type Definitions for PrioritAI
 * Comprehensive interfaces for Users, Organizations, and Damage Events
 */

// ============================================================================
// ENUMS
// ============================================================================

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const EventStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const DamageClassification = {
  LIGHT: 'Light',
  HEAVY: 'Heavy',
} as const;
export type DamageClassification = (typeof DamageClassification)[keyof typeof DamageClassification];

// ============================================================================
// ORGANIZATION TYPES
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  settlement_code: string;
  description?: string;
  region?: string;
  adminId?: string; // Mandatory admin for this org
  logoUrl?: string; // Optional org logo
  createdAt: Date;
  updatedAt?: Date;
  totalEvents?: number;
  totalUsers?: number;
}

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  jobTitle?: string;
  profileImage?: string;
  lastLogin?: Date;
  createdAt: Date;
  isActive: boolean;
}

// ============================================================================
// LOCATION & COORDINATES
// ============================================================================

export interface Location {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  postalCode?: string;
}

// ============================================================================
// GIS DETAILS
// ============================================================================

export interface GisDetails {
  distHospitalM: number;       // Distance to nearest hospital in meters
  distSchoolM: number;         // Distance to nearest school in meters
  distRoadM: number;           // Distance to nearest road in meters
  distStrategicM: number;      // Distance to nearest strategic/military site in meters
  populationDensity: number;   // Population density (persons/km²)
  geoMultiplier: number;       // Calculated geographic multiplier
}

// ============================================================================
// DAMAGE EVENT TYPES
// ============================================================================

export interface DamageEvent {
  id: string;
  organizationId: string;
  name?: string;           // Short event name/title
  location: Location;
  imageUrl: string;
  imageUrls?: string[];
  description: string;
  damageClassification?: DamageClassification; // 'Light' or 'Heavy'
  damageScore: number;    // 0-10: Raw AI damage score (Light=3, Heavy=7)
  priorityScore: number;  // 0-10: Final score = damageScore * geoMultiplier
  gisDetails?: GisDetails;
  status: EventStatus;
  hidden?: boolean;       // For hide/show toggle
  llmExplanation: string; // AI model explanation of damage
  aiModel?: string;       // Model name used for assessment
  createdBy: string;      // User ID
  createdAt: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
  estimatedRepairCost?: number;
  assignedTo?: string;    // User ID of assigned operator/admin
  tags?: string[];
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  read: boolean;
  createdAt: Date;
  eventId?: string;
}

// ============================================================================
// STATISTICS & ANALYTICS
// ============================================================================

export interface DashboardStats {
  totalEvents: number;
  pendingEvents: number;
  inProgressEvents: number;
  completedEvents: number;
  averageDamageScore: number;
  averagePriorityScore: number;
  highPriorityCount: number;   // priorityScore >= 7.5
  mediumPriorityCount: number; // 5.0 <= priorityScore < 7.5
  lowPriorityCount: number;    // priorityScore < 5.0
}

export interface EventsOverviewData {
  date: string;
  count: number;
  completed: number;
  pending: number;
}

// ============================================================================
// AUTH CONTEXT & SESSION
// ============================================================================

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface NewEventFormData {
  description: string;
  location: Location;
  imageUrl: string;
  damageScore?: number;
  tags?: string[];
}

export interface OrganizationFormData {
  name: string;
  settlement_code: string;
  description?: string;
  region?: string;
  adminId?: string;
}

export interface UserFormData {
  name: string;
  email: string;
  jobTitle?: string;
  role: UserRole;
  organizationId: string;
}

// ============================================================================
// FILTER & SORT TYPES
// ============================================================================

export interface EventFilterOptions {
  status?: EventStatus[];
  priorityScoreMin?: number;
  priorityScoreMax?: number;
  startDate?: Date;
  endDate?: Date;
  organizationId?: string;
  assignedTo?: string;
}

export interface SortOptions {
  sortBy: 'priorityScore' | 'createdAt' | 'damageScore' | 'status';
  sortOrder: 'asc' | 'desc';
}

export type EventTableColumn = 'id' | 'location' | 'damageScore' | 'priorityScore' | 'status' | 'createdAt' | 'description';