import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '../utils/auth';
import type { MeetingWebSocketMessage } from '../types/meeting-record';

export interface MeetingWebSocketState {
  connected: boolean;
  status: string | null;
  durationSeconds: number;
  segmentCount: number;
  segments: any[];
  processingStage: string | null;
  processingProgress: number;
  processingMessage: string;
  error: string | null;
}

export function useMeetingWebSocket(meetingId: string | undefined) {
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
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shouldConnect, setShouldConnect] = useState(true);

  const connect = useCallback(() => {
    if (!meetingId || !shouldConnect) return;
    
    const token = getToken();
    if (!token) return;

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
            }));
            break;
          case 'status_update':
            setState((prev) => ({
              ...prev,
              status: (msg.data as any).status,
              durationSeconds: (msg.data as any).duration_seconds,
              segmentCount: (msg.data as any).segment_count,
            }));
            break;
          case 'processing_update':
            setState((prev) => ({
              ...prev,
              processingStage: (msg.data as any).stage,
              processingProgress: (msg.data as any).progress,
              processingMessage: (msg.data as any).message,
            }));
            break;
          case 'error':
            setState((prev) => ({
              ...prev,
              error: (msg.data as any).message,
            }));
            break;
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, connected: false }));
      if (shouldConnect) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      setState((prev) => ({ ...prev, error: 'Connection error' }));
    };
  }, [meetingId, shouldConnect]);

  useEffect(() => {
    connect();
    return () => {
      setShouldConnect(false);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const disconnect = useCallback(() => {
    setShouldConnect(false);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  return {
    ...state,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
}
