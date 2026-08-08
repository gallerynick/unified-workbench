/** 通知推送渠道的唯一权威常量源。增删渠道只改这里。 */

export const NOTIFICATION_CHANNELS = [
  { id: 'websocket' as const, label: '站内通知' },
  { id: 'feishu'    as const, label: '飞书' },
  { id: 'email'     as const, label: '邮件' },
  { id: 'wecom'     as const, label: '企业微信' },
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]['id'];

export const CHANNEL_OPTIONS = NOTIFICATION_CHANNELS.map((c) => ({
  value: c.id,
  label: c.label,
}));

export const CHANNEL_TAG_MAP: Record<NotificationChannel, string> = Object.fromEntries(
  NOTIFICATION_CHANNELS.map((c) => [c.id, c.label])
) as Record<NotificationChannel, string>;

export const DEFAULT_CHANNELS: NotificationChannel[] = ['websocket'];
