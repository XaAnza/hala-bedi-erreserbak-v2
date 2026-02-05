export type Language = 'es' | 'eu';

export enum ResourceType {
  STUDIO = 'STUDIO',
  SPACE = 'SPACE'
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
}

export type RecurrenceType = 'none' | 'weekly' | 'biweekly' | 'monthly';

export interface Reservation {
  id: string;
  resourceId: string;
  date: string; // ISO Date YYYY-MM-DD
  startTime: string; // HH:mm
  duration: number; // in minutes
  userName: string;
  programName: string;
  programCode: string;
  createdAt: number;
  notified?: boolean;
}

export interface UserSession {
  isAuthenticated: boolean;
  isAdmin: boolean;
  language: Language;
}

export const RESOURCES: Resource[] = [
  { id: 'estudio-1', name: 'Estudio 1', type: ResourceType.STUDIO },
  { id: 'estudio-2', name: 'Estudio 2', type: ResourceType.STUDIO },
  { id: 'estudio-3', name: 'Estudio 3', type: ResourceType.STUDIO },
  { id: 'estudio-4', name: 'Estudio 4', type: ResourceType.STUDIO },
  { id: 'irrati-portatila', name: 'Irrati portatila', type: ResourceType.SPACE },
  { id: 'bilera-gela', name: 'Bilera Gela', type: ResourceType.SPACE },
  { id: 'ondoko-lokala', name: 'Ondoko Lokala', type: ResourceType.SPACE },
];

export const ACCESS_CODE = "HBI1983";
export const ADMIN_CODE = "HBI_admin_1312";
