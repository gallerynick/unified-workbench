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
