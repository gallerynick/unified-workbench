import type { Visibility } from '../utils/visibility';

export type EventRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  location: string | null;
  repeat: EventRepeat;
  color: string | null;
  owner_id?: string;
  visibility?: Visibility;
  restricted_users?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarEventCreate {
  title: string;
  description?: string | undefined;
  start_time: string;
  end_time?: string | undefined;
  all_day?: boolean | undefined;
  location?: string | undefined;
  repeat?: EventRepeat | undefined;
  color?: string | undefined;
  visibility?: Visibility | undefined;
  restricted_users?: string[] | undefined;
}

export interface CalendarEventUpdate {
  title?: string | undefined;
  description?: string | undefined;
  start_time?: string | undefined;
  end_time?: string | undefined;
  all_day?: boolean | undefined;
  location?: string | undefined;
  repeat?: EventRepeat | undefined;
  color?: string | undefined;
  visibility?: Visibility | undefined;
  restricted_users?: string[] | undefined;
}

export interface CalendarEventListResponse {
  items: CalendarEvent[];
  total: number;
}
