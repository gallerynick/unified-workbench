/** 项目会议/交流记录类型定义 */

export interface ProjectMeeting {
  id: string;
  project_id: string;
  number: string;
  type: string;
  started_at: string;
  speaker: string | null;
  participants: string[];
  content: string | null;
  notes: unknown[];
  created_at: string;
  updated_at: string;
}

export interface ProjectMeetingCreate {
  project_id: string;
  number: string;
  type: string;
  started_at: string;
  speaker?: string;
  participants?: string[];
  content?: string;
  notes?: unknown[];
}

export interface ProjectMeetingUpdate {
  number?: string;
  type?: string;
  started_at?: string;
  speaker?: string;
  participants?: string[];
  content?: string;
  notes?: unknown[];
}

export interface ProjectMeetingListResponse {
  items: ProjectMeeting[];
  total: number;
}
