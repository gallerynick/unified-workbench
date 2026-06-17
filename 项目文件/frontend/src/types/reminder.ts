export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'cancelled';
export type TriggerType = 'timed' | 'event';
export type NotificationChannel = 'websocket' | 'feishu' | 'dingtalk';

export interface Reminder {
  id: string;
  title: string;
  content: string | null;
  trigger_type: TriggerType;
  event_type: string | null;
  trigger_time: string | null;
  target_users: string[] | null;
  channels: NotificationChannel[] | null;
  status: ReminderStatus;
  creator_id: string;
  created_at: string;
}

export interface ReminderCreate {
  title: string;
  content?: string;
  trigger_type: TriggerType;
  event_type?: string;
  trigger_time?: string;
  target_users?: string[];
  channels?: NotificationChannel[];
}

export interface ReminderUpdate {
  title?: string;
  content?: string;
  event_type?: string;
  trigger_time?: string;
  target_users?: string[];
  channels?: NotificationChannel[];
  status?: ReminderStatus;
}

export interface ReminderListResponse {
  items: Reminder[];
  total: number;
}
