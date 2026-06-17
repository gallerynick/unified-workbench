export interface NotificationConfig {
  feishu_webhook_url: string;
  dingtalk_webhook_url: string;
  enabled_channels: string[];
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  wecom_webhook_url: string;
}

export interface SystemConfigResponse {
  key: string;
  value: Record<string, unknown>;
}
