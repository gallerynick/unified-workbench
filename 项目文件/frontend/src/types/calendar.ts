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
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventCreate {
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  all_day?: boolean;
  location?: string;
  repeat?: EventRepeat;
  color?: string;
}

export interface CalendarEventUpdate {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  location?: string;
  repeat?: EventRepeat;
  color?: string;
}

export interface CalendarEventListResponse {
  items: CalendarEvent[];
  total: number;
}
