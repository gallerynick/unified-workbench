/** 会议记录类型 */

export type MeetingStatus = 'not_started' | 'recording' | 'paused' | 'processing' | 'completed';
export type MeetingVisibility = 'private' | 'public' | 'restricted';
export type DiarizationStatus = 'pending' | 'done' | 'failed';
export type MinutesStatus = 'pending' | 'done' | 'failed';

export interface MeetingTranscriptSegment {
  id: string;
  meeting_id: string;
  seq: number;
  text: string;
  audio_start_ms: number;
  audio_end_ms: number | null;
  speaker: string | null;
  created_at: string;
}

export interface MeetingMinutes {
  id: string;
  meeting_id: string;
  summary: string;
  key_points: string[];
  todos: { content: string; source_quote: string }[];
  model_used: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingRecord {
  id: string;
  number: string;
  title: string;
  owner_id: string;
  visibility: MeetingVisibility;
  restricted_users: string[];
  restricted_tags: string[];
  status: MeetingStatus;
  paused_reason: 'manual' | 'client_left' | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  audio_file_path: string | null;
  diarization_status: DiarizationStatus;
  minutes_status: MinutesStatus;
  minutes_reviewed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  segments: MeetingTranscriptSegment[];
  minutes: MeetingMinutes | null;
}

export interface MeetingRecordCreate {
  title: string;
  visibility: MeetingVisibility;
  restricted_users: string[];
  restricted_tags: string[];
}

export interface MeetingRecordUpdate {
  title?: string;
  visibility?: MeetingVisibility;
  restricted_users?: string[];
  restricted_tags?: string[];
  notes?: string;
}

export interface MeetingRecordList {
  items: MeetingRecord[];
  total: number;
}

// WebSocket 消息类型
export interface WebSocketMessage {
  type: string;
  data: unknown;
}

export interface AudioChunkMessage extends WebSocketMessage {
  type: 'audio_chunk';
  data: {
    audio: string; // base64 PCM data
    sample_rate: number;
    channels: number;
    duration: number;
  };
}

export interface TranscriptSegmentData {
  seq: number;
  text: string;
  audio_start_ms: number;
  audio_end_ms: number;
  /** 说话人标签（说话人1/2/…，未分离时为 null） */
  speaker?: string | null;
}

export interface TranscriptSegmentMessage extends WebSocketMessage {
  type: 'transcript_segment';
  data: TranscriptSegmentData;
}

export interface StatusUpdateData {
  status: MeetingStatus;
  duration_seconds: number;
  segment_count: number;
}

export interface StatusUpdateMessage extends WebSocketMessage {
  type: 'status_update';
  data: StatusUpdateData;
}

export interface ProcessingUpdateMessage extends WebSocketMessage {
  type: 'processing_update';
  data: {
    stage: 'diarization' | 'minutes';
    progress: number;
    message: string;
  };
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  data: {
    code: string;
    message: string;
  };
}

export interface WarningMessage extends WebSocketMessage {
  type: 'warning';
  data: {
    message: string;
  };
}

export type MeetingWebSocketMessage =
  | AudioChunkMessage
  | TranscriptSegmentMessage
  | StatusUpdateMessage
  | ProcessingUpdateMessage
  | ErrorMessage
  | WarningMessage;