import { request } from '../utils/request';
import type {
  MeetingRecord,
  MeetingRecordCreate,
  MeetingRecordUpdate,
  MeetingRecordList,
  MeetingTranscriptSegment,
} from '../types/meeting-record';
import type { UnifiedResponse } from '../types/user';

export interface MeetingRecordListParams {
  page?: number;
  page_size?: number;
  status?: string;
}

export async function listMeetingRecords(
  params: MeetingRecordListParams,
): Promise<UnifiedResponse<MeetingRecordList>> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  if (params.status) searchParams.set('status', params.status);
  const query = searchParams.toString();
  return request<MeetingRecordList>('/meetings/' + (query ? '?' + query : ''));
}

export async function getMeetingRecord(id: string): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>('/meetings/' + id);
}

export async function createMeetingRecord(
  data: MeetingRecordCreate,
): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>('/meetings/', { method: 'POST', body: data });
}

export async function updateMeetingRecord(
  id: string,
  data: MeetingRecordUpdate,
): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>('/meetings/' + id, { method: 'PATCH', body: data });
}

export async function autosaveMeetingRecord(
  id: string,
  data: {
    notes?: string | null;
    transcript_segments?: Array<{
      seq: number;
      text: string;
      audio_start_ms: number;
      audio_end_ms: number | null;
      speaker?: string | null;
    }>;
  },
): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>('/meetings/' + id + '/autosave', { method: 'POST', body: data });
}

export async function deleteMeetingRecord(id: string): Promise<UnifiedResponse<null>> {
  return request<null>('/meetings/' + id, { method: 'DELETE' });
}

export async function startMeeting(id: string): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>('/meetings/' + id + '/start', { method: 'POST' });
}

export async function pauseMeeting(id: string): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>('/meetings/' + id + '/pause', { method: 'POST' });
}

export async function resumeMeeting(id: string): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>('/meetings/' + id + '/resume', { method: 'POST' });
}

export async function endMeeting(id: string): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>('/meetings/' + id + '/end', { method: 'POST' });
}

export async function getTranscript(id: string): Promise<UnifiedResponse<MeetingTranscriptSegment[]>> {
  return request<MeetingTranscriptSegment[]>('/meetings/' + id + '/transcript');
}

export async function reviewMinutes(id: string): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>('/meetings/' + id + '/minutes/review', { method: 'POST' });
}

export async function exportMeeting(
  id: string,
  exportType: 'transcript' | 'audio' | 'minutes',
): Promise<UnifiedResponse<unknown>> {
  return request<unknown>('/meetings/' + id + '/export?export_type=' + exportType, { method: 'POST' });
}
