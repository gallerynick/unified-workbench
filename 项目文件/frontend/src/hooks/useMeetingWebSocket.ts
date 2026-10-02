import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '../utils/auth';
import type { MeetingWebSocketMessage, TranscriptSegmentData } from '../types/meeting-record';

export interface MeetingWebSocketState {
  connected: boolean;
  status: string | null;
  durationSeconds: number;
  segmentCount: number;
  segments: TranscriptSegmentData[];
  processingStage: string | null;
  processingProgress: number;
  processingMessage: string;
  error: string | null;
  warningMessage: string | null;
}

/**
 * 会议 WebSocket 连接 Hook
 * @param meetingId 会议 ID
 * @param shouldConnect 是否应该连接（由外部根据会议状态控制）
 */
export function useMeetingWebSocket(
  meetingId: string | undefined,
  shouldConnect = false,
) {
  const [state, setState] = useState<MeetingWebSocketState>({
    connected: false,
    status: null,
    durationSeconds: 0,
    segmentCount: 0,
    segments: [],
    processingStage: null,
    processingProgress: 0,
    processingMessage: '',
    error: null,
    warningMessage: null,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldConnectRef = useRef(shouldConnect);

  // 同步 shouldConnect 到 ref，避免闭包问题
  useEffect(() => {
    shouldConnectRef.current = shouldConnect;
  }, [shouldConnect]);

  const connect = useCallback(() => {
    if (!meetingId || !shouldConnectRef.current) return;

    const token = getToken();
    if (!token) return;

    // 避免重复连接
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host + '/ws/meetings/' + meetingId + '?token=' + token;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, connected: true, error: null }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as MeetingWebSocketMessage;

        switch (msg.type) {
          case 'transcript_segment':
            setState((prev) => ({
              ...prev,
              segments: [...prev.segments, msg.data],
              segmentCount: prev.segmentCount + 1,
              // 已出转录结果说明识别正常，清掉「载入中」等警告
              warningMessage: null,
            }));
            break;
          case 'status_update':
            setState((prev) => ({
              ...prev,
              status: msg.data.status,
              durationSeconds: msg.data.duration_seconds,
              segmentCount: msg.data.segment_count,
            }));
            break;
          case 'processing_update':
            setState((prev) => ({
              ...prev,
              processingStage: msg.data.stage,
              processingProgress: msg.data.progress,
              processingMessage: msg.data.message,
            }));
            break;
          case 'warning':
            setState((prev) => ({
              ...prev,
              warningMessage: msg.data.message,
            }));
            console.warn('WebSocket warning:', msg.data.message);
            break;
          case 'error':
            setState((prev) => ({
              ...prev,
              error: msg.data.message,
            }));
            break;
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, connected: false, warningMessage: null }));
      // 只有在应该连接的情况下才重连
      if (shouldConnectRef.current) {
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = () => {
      setState((prev) => ({ ...prev, error: '连接失败' }));
    };
  }, [meetingId]);

  // 当 shouldConnect 变化时，建立或断开连接
  useEffect(() => {
    if (shouldConnect && meetingId) {
      connect();
    } else {
      // 断开连接
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setState((prev) => ({ ...prev, connected: false }));
    }

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [shouldConnect, meetingId, connect]);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    ...state,
    sendMessage,
    connect,
  };
}
