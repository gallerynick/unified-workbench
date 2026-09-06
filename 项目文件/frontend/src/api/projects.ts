import { request } from '../utils/request';
import { getToken } from '../utils/auth';
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectListResponse,
} from '../types/project';
import type { UnifiedResponse } from '../types/user';

/** 项目导出支持的文件格式 */
export type ProjectExportFormat = 'docx' | 'xlsx';

/**
 * 导出项目为 Word / Excel 文件（触发浏览器下载）。
 * 文件流不走 request 的 JSON 解析，单独用 fetch + blob 处理。
 */
export async function exportProjectFile(
  id: string,
  fmt: ProjectExportFormat,
): Promise<void> {
  const token = getToken();
  const resp = await fetch(`/api/v1/projects/${id}/export?format=${fmt}`, {
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
  let fileName = `project-${id}.${fmt}`;
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

export async function listProjects(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}): Promise<UnifiedResponse<ProjectListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.page_size) searchParams.set('page_size', String(params.page_size));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return request<ProjectListResponse>(`/projects/${query ? `?${query}` : ''}`);
}

export async function getProject(id: string): Promise<UnifiedResponse<Project>> {
  return request<Project>(`/projects/${id}`);
}

export async function createProject(data: ProjectCreate): Promise<UnifiedResponse<Project>> {
  return request<Project>('/projects/', {
    method: 'POST',
    body: data as unknown as Record<string, unknown>,
  });
}

export async function updateProject(id: string, data: ProjectUpdate): Promise<UnifiedResponse<Project>> {
  return request<Project>(`/projects/${id}`, {
    method: 'PUT',
    body: data as unknown as Record<string, unknown>,
  });
}

export async function deleteProject(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/projects/${id}`, {
    method: 'DELETE',
  });
}
