export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Matches PostgreSQL event_status.name */
export const EventStatus = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export interface EventStatusHistoryEntry {
  oldStatus: string;
  newStatus: string;
  changedBy: number;
  changedByName: string;
  changedAt: string;
}

export const DamageClassification = {
  LIGHT: 'Light',
  HEAVY: 'Heavy',
} as const;
export type DamageClassification = (typeof DamageClassification)[keyof typeof DamageClassification];

/** Organization — IDs match PostgreSQL (organizations.id, settlement_id). */
export interface Organization {
  id: number;
  externalId?: string | null;
  name: string;
  settlementId: number;
  settlement_code: string;
  settlementName?: string;
  description?: string;
  adminId?: number | null;
  logoUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
  totalEvents?: number;
  totalUsers?: number;
}

/** User — IDs match PostgreSQL (users.id, role_id, organization_id). */
export interface User {
  id: number;
  externalId?: string | null;
  name: string;
  email: string;
  role: UserRole;
  roleId: number;
  organizationId: number | null;
  jobTitle?: string;
  profileImage?: string;
  lastLogin?: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface Location {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  postalCode?: string;
}

export interface GisDetails {
  distHospitalM: number;
  distSchoolM: number;
  distRoadM: number;
  distStrategicM: number;
  populationDensity: number;
  geoMultiplier: number;
}

/** Damage event — IDs match PostgreSQL (events.id, organization_id, created_by). */
export interface DamageEvent {
  id: number;
  organizationId: number;
  name?: string;
  location: Location;
  imageUrl: string;
  imageUrls?: string[];
  description: string;
  damageClassification?: DamageClassification;
  damageScore: number;
  priorityScore: number;
  gisDetails?: GisDetails;
  gisStatus?: 'pending' | 'done';
  status: EventStatus;
  hidden?: boolean;
  llmExplanation: string;
  aiModel?: string;
  createdBy: number;
  createdByName?: string;
  createdAt: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
  estimatedRepairCost?: number;
  assignedTo?: string;
  tags?: string[];
  /** Present when loaded with GET /events/:id?detail=true */
  history?: EventStatusHistoryEntry[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  read: boolean;
  createdAt: Date;
  eventId?: number;
}

export interface DashboardStats {
  totalEvents: number;
  pendingEvents: number;
  inProgressEvents: number;
  completedEvents: number;
  averageDamageScore: number;
  averagePriorityScore: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
}

export interface EventsOverviewData {
  date: string;
  count: number;
  completed: number;
  pending: number;
}

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
  adminId?: number;
}

export interface UserFormData {
  name: string;
  email: string;
  jobTitle?: string;
  role: UserRole;
  organizationId: number;
}

export interface EventFilterOptions {
  status?: EventStatus[];
  priorityScoreMin?: number;
  priorityScoreMax?: number;
  startDate?: Date;
  endDate?: Date;
  organizationId?: number;
  assignedTo?: string;
}

export interface SortOptions {
  sortBy: 'priorityScore' | 'createdAt' | 'damageScore' | 'status';
  sortOrder: 'asc' | 'desc';
}

export type EventTableColumn = 'id' | 'location' | 'damageScore' | 'priorityScore' | 'status' | 'createdAt' | 'description';
