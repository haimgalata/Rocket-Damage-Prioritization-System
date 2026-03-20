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

export interface Organization {
  id: string;
  name: string;
  settlement_code: string;
  description?: string;
  region?: string;
  adminId?: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
  totalEvents?: number;
  totalUsers?: number;
}

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

export interface DamageEvent {
  id: string;
  organizationId: string;
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
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
  estimatedRepairCost?: number;
  assignedTo?: string;
  tags?: string[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  read: boolean;
  createdAt: Date;
  eventId?: string;
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
