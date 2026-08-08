export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface Reminder {
  id: string;
  title: string;
  content: string | null;
  trigger_time: string | null;
  target_users: string[] | null;
  status: ReminderStatus;
  creator_id: string;
  created_at: string;
}

export interface ReminderCreate {
  title: string;
  content?: string;
  trigger_time?: string;
  target_users?: string[];
}

export interface ReminderUpdate {
  title?: string;
  content?: string;
  trigger_time?: string;
  target_users?: string[];
  status?: ReminderStatus;
}

export interface ReminderListResponse {
  items: Reminder[];
  total: number;
}
