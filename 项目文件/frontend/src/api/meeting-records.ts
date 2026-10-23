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

/** 说话人分离模型状态（缺失时前端提示并可一键下载） */
export interface SpeakerModelStatus {
  available: boolean;
  reason: string;
  downloading: boolean;
  message: string;
  models: {
    label: string;
    path: string;
    present: boolean;
    bytes: number;
    expected_bytes: number;
  }[];
}

export async function getSpeakerModelStatus(): Promise<UnifiedResponse<SpeakerModelStatus>> {
  return request<SpeakerModelStatus>('/meetings/speaker-model');
}

export async function downloadSpeakerModel(): Promise<UnifiedResponse<SpeakerModelStatus>> {
  return request<SpeakerModelStatus>('/meetings/speaker-model/download', { method: 'POST' });
}

/** 导入会议录音（上传音频后自动触发识别） */
export async function importMeetingAudio(id: string, file: File): Promise<UnifiedResponse<MeetingRecord>> {
  const form = new FormData();
  form.append('file', file);
  return request<MeetingRecord>('/meetings/' + id + '/audio-import', { method: 'POST', body: form });
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

export async function generateMinutes(id: string): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>('/meetings/' + id + '/minutes/generate', { method: 'POST' });
}

/** 批量改说话人显示名：{"说话人1": "张三", ...}，会后「再次生成」会用新名字 */
export async function updateSpeakerNames(
  id: string,
  mapping: Record<string, string>,
): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>('/meetings/' + id + '/speakers', { method: 'PUT', body: mapping });
}

/** 手动指定某一句的说话人（模型分不出来时的最终出口） */
export async function setSegmentSpeaker(
  id: string,
  seq: number,
  speaker: string | null,
): Promise<UnifiedResponse<null>> {
  const q = speaker ? '?speaker=' + encodeURIComponent(speaker) : '';
  return request<null>('/meetings/' + id + '/segments/' + seq + '/speaker' + q, {
    method: 'PATCH',
  });
}

/** 按指定人数重新区分说话人（不重跑转写） */
export async function rediarizeSpeakers(
  id: string,
  numSpeakers: number,
): Promise<UnifiedResponse<MeetingRecord>> {
  return request<MeetingRecord>(
    '/meetings/' + id + '/speakers/rediarize?num_speakers=' + numSpeakers,
    { method: 'PUT' },
  );
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
