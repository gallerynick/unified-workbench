import { request } from '../utils/request';
import type {
  BacklinkItem,
  GraphData,
  Note,
  NoteBody,
  NoteCreate,
  NoteDraft,
  NoteFolder,
  NoteFolderBrief,
  NoteFolderListResponse,
  NoteListResponse,
  NoteUpdate,
  TagCount,
} from '../types/note';
import type { UnifiedResponse } from '../types/user';

/** 列表查询参数。tag 为单值：后端按 JSON 数组元素精确匹配。 */
export interface NoteListParams {
  page?: number | undefined;
  page_size?: number | undefined;
  search?: string | undefined;
  tag?: string | undefined;
  /** 按文件夹过滤。 */
  folder_id?: string | undefined;
}

function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listNotes(params?: NoteListParams): Promise<UnifiedResponse<NoteListResponse>> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.page_size,
    search: params?.search,
    tag: params?.tag,
    folder_id: params?.folder_id,
  });
  return request<NoteListResponse>(`/notes/${query}`);
}

export async function listAllNotes(): Promise<UnifiedResponse<NoteListResponse>> {
  return request<NoteListResponse>('/notes/all');
}

export async function createNote(data: NoteCreate): Promise<UnifiedResponse<Note>> {
  return request<Note>('/notes/', { method: 'POST', body: data });
}

export async function getNote(id: string): Promise<UnifiedResponse<Note>> {
  return request<Note>(`/notes/${id}`);
}

export async function updateNote(id: string, data: NoteUpdate): Promise<UnifiedResponse<Note>> {
  return request<Note>(`/notes/${id}`, { method: 'PUT', body: data });
}

export async function deleteNote(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/notes/${id}`, { method: 'DELETE' });
}

// ── 文件夹 ─────────────────────────────────────────────────────────────

export async function listFolders(): Promise<UnifiedResponse<NoteFolderListResponse>> {
  return request<NoteFolderListResponse>('/notes/folders');
}

export async function createFolder(data: { name: string; description?: string | null; sort_order?: number }): Promise<UnifiedResponse<NoteFolder>> {
  return request<NoteFolder>('/notes/folders', { method: 'POST', body: data });
}

export async function updateFolder(
  id: string,
  data: { name?: string; description?: string | null; sort_order?: number },
): Promise<UnifiedResponse<NoteFolder>> {
  return request<NoteFolder>(`/notes/folders/${id}`, { method: 'PATCH', body: data });
}

export async function deleteFolder(id: string): Promise<UnifiedResponse<null>> {
  return request<null>(`/notes/folders/${id}`, { method: 'DELETE' });
}

export async function listNoteFolders(id: string): Promise<UnifiedResponse<NoteFolderBrief[]>> {
  return request<NoteFolderBrief[]>(`/notes/${id}/folders`);
}

/** 全量替换笔记的文件夹归属；传空数组表示移出全部文件夹。 */
export async function setNoteFolders(id: string, folderIds: string[]): Promise<UnifiedResponse<Note>> {
  return request<Note>(`/notes/${id}/folders`, { method: 'PUT', body: { folder_ids: folderIds } });
}

// ── 双链 / 图谱 / 标签 / 草稿 ────────────────────────────────────────────

export async function getBacklinks(noteId: string): Promise<UnifiedResponse<BacklinkItem[]>> {
  return request<BacklinkItem[]>(`/notes/${noteId}/backlinks`);
}

/** 局部图谱：以 noteId 为根的双向 N 跳遍历（后端限制 depth 1~2）。 */
export async function getGraph(noteId: string, depth = 1): Promise<UnifiedResponse<GraphData>> {
  return request<GraphData>(`/notes/${noteId}/graph?depth=${depth}`);
}

/** 全局图谱：可见笔记为节点。 */
export async function getGlobalGraph(): Promise<UnifiedResponse<GraphData>> {
  return request<GraphData>('/notes/graph');
}

export async function listNoteTags(): Promise<UnifiedResponse<TagCount[]>> {
  return request<TagCount[]>('/notes/tags');
}

/** noteId 为空表示尚未关联笔记的新笔记草稿。无草稿时 data 为 null。 */
export async function getDraft(noteId?: string | null): Promise<UnifiedResponse<NoteDraft | null>> {
  return request<NoteDraft | null>(`/notes/draft${buildQuery({ note_id: noteId })}`);
}

export async function saveDraft(
  noteId: string | null,
  title: string | null,
  body: NoteBody,
): Promise<UnifiedResponse<NoteDraft>> {
  return request<NoteDraft>('/notes/draft', {
    method: 'PUT',
    body: { note_id: noteId, title, body },
  });
}

export async function deleteDraft(noteId?: string | null): Promise<UnifiedResponse<null>> {
  return request<null>(`/notes/draft${buildQuery({ note_id: noteId })}`, { method: 'DELETE' });
}
