import { getToken, getRefreshToken, setTokens, clearTokens } from './auth';
import type { UnifiedResponse } from '../types/user';

const BASE_URL = '/api/v1';

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const result = await response.json();
    if (result.code === 0 && result.data) {
      setTokens(result.data);
      return true;
    }

    clearTokens();
    return false;
  } catch {
    clearTokens();
    return false;
  }
}

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<UnifiedResponse<T>> {
  const { method = 'GET', body, headers = {} } = options;
  const token = getToken();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  // 防止浏览器对 GET 请求做启发式缓存，避免 Safari/Edge 等浏览器显示过时数据
  if (method === 'GET') {
    requestHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    requestHeaders['Pragma'] = 'no-cache';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : null,
    redirect: 'follow',
  });

  // Handle 401 - try to refresh token
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = getToken();
      if (newToken) {
        requestHeaders['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(`${BASE_URL}${endpoint}`, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : null,
        });
        if (retryResponse.ok) {
          return retryResponse.json();
        }
      }
    }
    // Refresh failed - redirect to login
    window.location.href = '/login';
    throw new Error('Authentication failed');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    // FastAPI 422 验证错误返回 { detail: [{ msg: "...", loc: [...], type: "..." }] }
    const msg = Array.isArray(error.detail)
      ? error.detail.map((e: { msg: string; loc?: string[] }) =>
          e.loc ? `${e.loc.join('.')}: ${e.msg}` : e.msg
        ).join('; ')
      : (error.detail || error.msg || `HTTP ${response.status}`);
    throw new HttpError(msg, response.status);
  }

  return response.json();
}

export function uploadWithProgress(
  url: string,
  file: File,
  onProgress?: (percent: number) => void,
  extraData?: Record<string, string>
): Promise<UnifiedResponse<unknown>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    if (extraData) {
      for (const [key, value] of Object.entries(extraData)) {
        formData.append(key, value);
      }
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));

    xhr.open('POST', `${BASE_URL}${url}`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}
