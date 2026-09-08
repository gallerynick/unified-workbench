import { request } from '../utils/request';
import { getDeviceToken } from '../utils/device';
import type { UnifiedResponse, LoginResponse, TwoFAStatus, TwoFADevice } from '../types/user';

/** 登录第二步：用动态码或恢复码完成二次验证。 */
export async function verify2fa(
  pendingToken: string,
  code: string
): Promise<UnifiedResponse<LoginResponse>> {
  return request<LoginResponse>('/auth/verify-2fa', {
    method: 'POST',
    body: { pending_token: pendingToken, code },
    headers: { 'X-Device-Token': getDeviceToken() },
  });
}

/** 获取当前用户 2FA 状态。 */
export async function getTwoFAStatus(): Promise<UnifiedResponse<TwoFAStatus>> {
  return request<TwoFAStatus>('/auth/2fa/status');
}

/** 列出当前用户已绑定的认证器设备。 */
export async function listTwoFADevices(): Promise<UnifiedResponse<TwoFADevice[]>> {
  return request<TwoFADevice[]>('/auth/2fa/devices');
}

/** 创建待绑定设备，返回 device_id + 明文密钥 + otpauth URI。 */
export async function setupTwoFA(password: string, label?: string): Promise<
  UnifiedResponse<{ device_id: string; secret: string; otpauth_uri: string }>
> {
  return request<{ device_id: string; secret: string; otpauth_uri: string }>('/auth/2fa/setup', {
    method: 'POST',
    body: { password, label },
  });
}

/** 用动态码激活待绑定设备。 */
export async function activateTwoFA(deviceId: string, code: string): Promise<UnifiedResponse<null>> {
  return request<null>('/auth/2fa/activate', {
    method: 'POST',
    body: { device_id: deviceId, code },
  });
}

/** 删除已绑定的认证器设备（需校验密码）。 */
export async function removeTwoFADevice(deviceId: string, password: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/auth/2fa/devices/${deviceId}/remove`, {
    method: 'POST',
    body: { password },
  });
}

/** 关闭 2FA（删除全部设备与恢复码，需校验密码）。 */
export async function disableTwoFA(password: string): Promise<UnifiedResponse<null>> {
  return request<null>('/auth/2fa/disable', {
    method: 'POST',
    body: { password },
  });
}

/** 重新生成恢复码（返回明文，仅展示一次）。 */
export async function generateRecoveryCodes(password: string): Promise<UnifiedResponse<{ codes: string[] }>> {
  return request<{ codes: string[] }>('/auth/2fa/recovery-codes', {
    method: 'POST',
    body: { password },
  });
}

// WebAuthn

export interface WebAuthnAuthOptions {
  challenge: string;
  rp_id: string;
  timeout: number;
  allow_credentials: string[];
  user_verification: string;
}

export interface WebAuthnCredential {
  id: string;
  credential_id: string;
  label: string;
  transports: string;
  created_at: string;
  last_used_at: string | null;
}

export interface WebAuthnLoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function webauthnRegisterStart(label: string | undefined = undefined) {
  return request<Record<string, any>>('/auth/webauthn/register/start', { method: 'POST', body: { label: label || 'auth' } });
}

export async function webauthnRegisterFinish(data: object) {
  return request<Record<string, any>>('/auth/webauthn/register/finish', { method: 'POST', body: data });
}

export async function webauthnAuthStart(credentialIds: string[] | undefined = undefined) {
  return request<WebAuthnAuthOptions>('/auth/webauthn/authenticate/start', { method: 'POST', body: { credential_ids: credentialIds } });
}

export async function webauthnAuthFinish(data: object) {
  return request<Record<string, any>>('/auth/webauthn/authenticate/finish', { method: 'POST', body: data });
}

export async function listWebAuthnCredentials() {
  return request<WebAuthnCredential[]>('/auth/webauthn/credentials');
}

export async function removeWebAuthnCredential(credentialId: string) {
  return request<null>('/auth/webauthn/credentials/' + credentialId + '/remove', { method: 'POST' });
}





export async function webauthnAuthStartLogin(pendingToken: string) {
  return request<WebAuthnAuthOptions>('/auth/webauthn/authenticate/start-login', {
    method: 'POST',
    body: { pending_token: pendingToken },
  });
}

export async function checkWebAuthnLoginAvailability(pendingToken: string) {
  return request<{ has_credentials: boolean }>('/auth/webauthn/authenticate/check-login', {
    method: 'POST',
    body: { pending_token: pendingToken },
  });
}

export async function webauthnVerifyLogin(data: object) {
  return request<WebAuthnLoginResponse>('/auth/webauthn/verify-login', { method: 'POST', body: data, headers: { 'X-Device-Token': getDeviceToken() } });
}

export async function webauthnLoginStart() {
  return request<WebAuthnAuthOptions>('/auth/webauthn/login/start', { method: 'POST' });
}

export async function webauthnLoginFinish(data: object) {
  return request<WebAuthnLoginResponse>('/auth/webauthn/login/finish', { method: 'POST', body: data, headers: { 'X-Device-Token': getDeviceToken() } });
}

export async function webauthnVerifyLock(data: object) {
  return request<{ valid: boolean }>('/auth/webauthn/verify-lock', { method: 'POST', body: data });
}