export interface User {
  id: string;
  username: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  avatar: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'disabled';
  tags: Tag[];
  created_at: string;
  bio?: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

/** 登录响应：未启用 2FA 直接返回令牌；已启用则 pending_2fa=true 并返回 pending_token。 */
export interface LoginResponse {
  access_token: string | null;
  refresh_token: string | null;
  token_type: string;
  pending_2fa: boolean;
  pending_token: string | null;
}

/** 当前用户 2FA 状态。 */
export interface TwoFAStatus {
  enabled: boolean;
  device_count: number;
  recovery_codes_remaining: number;
}

/** 已绑定的 TOTP 认证器设备。 */
export interface TwoFADevice {
  id: string;
  label: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface UserCreateRequest {
  username: string;
  password: string;
  nickname: string;
  role?: 'admin' | 'member';
  tags?: string[];
}

export interface UserUpdateRequest {
  nickname?: string;
  avatar?: string;
  role?: 'admin' | 'member';
  status?: 'active' | 'disabled';
  tags?: string[];
}

export interface PasswordChangeRequest {
  old_password: string;
  new_password: string;
}

export interface UnifiedResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export interface ListParams {
  page?: number;
  page_size?: number;
  search?: string;
}

export interface UserNotificationConfig {
  enabled_channels: string[];
  feishu_webhook_url: string | null;
  wecom_webhook_url: string | null;
  email_enabled: boolean;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_use_tls: boolean;
}