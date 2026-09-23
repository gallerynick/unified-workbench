import { request } from '../utils/request';
import { getToken } from '../utils/auth';
import type {
  FormCreate,
  FormExportFormat,
  FormItem,
  FormListResponse,
  FormMyResponse,
  FormPublic,
  FormResponseItem,
  FormStats,
  FormUpdate,
} from '../types/form';
import type { UnifiedResponse } from '../types/user';

export async function listForms(params?: { page?: number; page_size?: number }): Promise<UnifiedResponse<FormListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  const query = searchParams.toString();
  return request<FormListResponse>(`/forms/${query ? `?${query}` : ''}`);
}

export async function createForm(data: FormCreate): Promise<UnifiedResponse<FormItem>> {
  return request<FormItem>('/forms/', { method: 'POST', body: data });
}

export async function getForm(id: string): Promise<UnifiedResponse<FormItem>> {
  return request<FormItem>(`/forms/${id}`);
}

/** 更新表单元信息（字段结构不可修改） */
export async function updateForm(id: string, data: FormUpdate): Promise<UnifiedResponse<FormItem>> {
  return request<FormItem>(`/forms/${id}`, { method: 'PATCH', body: data });
}

export async function deleteForm(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/forms/${id}`, { method: 'DELETE' });
}

export async function submitFormResponse(formId: string, data: Record<string, unknown>): Promise<UnifiedResponse<null>> {
  return request<null>(`/forms/${formId}/submit`, { method: 'POST', body: { data } });
}

/** 拉取填写页所需定义。skipAuthRedirect 为 true 时 401 不跳登录，交由调用方就地提示拦截 */
export async function getFormPublic(
  id: string,
  skipAuthRedirect = false
): Promise<{ code: number; data: FormPublic | null }> {
  return request(`/forms/${id}/public`, { skipAuthRedirect });
}

export async function getFormResponses(id: string, page = 1, pageSize = 20): Promise<{ code: number; data: { items: FormResponseItem[]; total: number } | null }> {
  return request(`/forms/${id}/responses?page=${page}&page_size=${pageSize}`);
}

/** 表单统计聚合结果（零回复时返回全 0 骨架） */
export async function getFormStats(id: string): Promise<UnifiedResponse<FormStats>> {
  return request<FormStats>(`/forms/${id}/stats`);
}

/** 填写者查看自己已提交的内容；未登录或未提交时 code 非 0 */
export async function getMyResponse(id: string): Promise<UnifiedResponse<FormMyResponse>> {
  return request<FormMyResponse>(`/forms/${id}/my-response`);
}

/**
 * 导出表单结果为 Excel / CSV 文件（触发浏览器下载）。
 * 文件流不走 request 的 JSON 解析，单独用 fetch + blob 处理。
 */
export async function exportFormFile(id: string, fmt: FormExportFormat): Promise<void> {
  const token = getToken();
  const resp = await fetch(`/api/v1/forms/${id}/export?format=${fmt}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) {
    const json = await resp.json().catch(() => null);
    const detail = json && (json.detail || json.msg);
    throw new Error(typeof detail === 'string' ? detail : `HTTP ${resp.status}`);
  }
  const blob = await resp.blob();
  // 从 Content-Disposition 解析文件名（优先 RFC 5987 filename*，回退 ASCII filename）
  const cd = resp.headers.get('Content-Disposition') || '';
  let fileName = `form-${id}.${fmt}`;
  const star = cd.match(/filename\*=UTF-8''([^;]+)/);
  if (star && star[1]) {
    try {
      fileName = decodeURIComponent(star[1]);
    } catch {
      fileName = star[1];
    }
  } else {
    const plain = cd.match(/filename="?([^";]+)"?/);
    if (plain && plain[1]) fileName = plain[1];
  }
  const url = window.URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
}
