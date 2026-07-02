import { request } from '../utils/request';
import type {
  FileRecord,
  FileListResponse,
  Folder,
  FolderCreateRequest,
  FolderUpdateRequest,
} from '../types/file';
import type { UnifiedResponse } from '../types/user';

export async function listFiles(params?: {
  folder_id?: string;
  page?: number;
  page_size?: number;
}): Promise<UnifiedResponse<FileListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.folder_id) searchParams.set('folder_id', params.folder_id);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.page_size) searchParams.set('page_size', params.page_size.toString());

  const query = searchParams.toString();
  return request<FileListResponse>(`/files/${query ? `?${query}` : ''}`);
}

export async function getFile(id: string): Promise<UnifiedResponse<FileRecord>> {
  return request<FileRecord>(`/files/${id}`);
}

export async function deleteFile(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/files/${id}`, {
    method: 'DELETE',
  });
}

export async function listFolders(): Promise<UnifiedResponse<Folder[]>> {
  return request<Folder[]>('/files/folders');
}

export async function createFolder(data: FolderCreateRequest): Promise<UnifiedResponse<Folder>> {
  return request<Folder>('/files/folders', {
    method: 'POST',
    body: data,
  });
}

export async function deleteFolder(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/files/folders/${id}`, {
    method: 'DELETE',
  });
}

export async function updateFolder(
  id: string,
  data: FolderUpdateRequest
): Promise<UnifiedResponse<Folder>> {
  return request<Folder>(`/files/folders/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

export async function updateFile(
  id: string,
  data: { expires_at?: string | null }
): Promise<UnifiedResponse<FileRecord>> {
  return request<FileRecord>(`/files/${id}`, {
    method: 'PATCH',
    body: data,
  });
}
