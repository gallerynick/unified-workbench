export interface StreamConfig {
  server_url: string;
  server_port: number;
  default_bitrate: number;
  default_resolution: string;
  default_fps: number;
  max_bitrate: number;
  min_bitrate: number;
  enable_auth: boolean;
  audio_sample_rate: number;
  audio_channels: number;
  audio_processing_mode: 'standard' | 'voice' | 'direct';
  audio_noise_suppression: boolean;
  audio_echo_cancellation: boolean;
  audio_auto_gain_control: boolean;
  audio_highpass_freq: number;
  audio_compressor_threshold: number;
  audio_compressor_ratio: number;
  audio_limiter_threshold: number;
  audio_output_gain: number;
}

/** @deprecated 使用 StreamRoom 替代，stream_key 已废弃由系统自动生成 */
export interface StreamKey {
  stream_key: string;
  push_url: string;
  watch_url?: string;
}

export interface StreamRoomConfig {
  default_bitrate: number;
  default_resolution: string;
  default_fps: number;
  audio_sample_rate: number;
  audio_channels: number;
  audio_processing_mode: string;
  audio_noise_suppression: boolean;
  audio_echo_cancellation: boolean;
  audio_auto_gain_control: boolean;
  audio_highpass_freq: number;
  audio_compressor_threshold: number;
  audio_compressor_ratio: number;
  audio_limiter_threshold: number;
  audio_output_gain: number;
}

export interface StreamRoom {
  id: string;
  name: string;
  creator_id: string;
  creator_nickname?: string;
  mode: 'builtin' | 'external';
  room_type: 'temporary' | 'permanent';
  config: StreamRoomConfig | null;
  is_open: boolean;
  is_active: boolean;
  pusher_id: string | null;
  pusher_nickname?: string;
  last_active_at: string | null;
  created_at: string;
  push_url: string;
  watch_url: string;
  rtmp_url: string;
}

export interface StreamRoomCreate {
  name: string;
  mode?: string;
  room_type?: string;
  is_open?: boolean;
  config?: StreamRoomConfig | null;
}

export interface StreamRoomUpdate {
  name?: string;
  mode?: string;
  room_type?: string;
  is_open?: boolean;
  is_active?: boolean;
  config?: StreamRoomConfig | null;
}

export interface StreamRoomListResponse {
  items: StreamRoom[];
  total: number;
}
