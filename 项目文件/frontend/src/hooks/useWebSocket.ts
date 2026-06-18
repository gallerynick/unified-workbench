import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '../utils/auth';

export interface Notification {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  read: boolean;
}

export function useWebSocket() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // 心跳
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        } else {
          clearInterval(heartbeat);
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      if (event.data === 'pong') return;

      try {
        const data = JSON.parse(event.data) as {
          type: string;
          title?: string;
          message?: string;
          content?: string;
        };
        if (data.type === 'notification') {
          const notification: Notification = {
            id: Date.now().toString(),
            title: data.title ?? '',
            content: data.message ?? data.content ?? '',
            timestamp: Date.now(),
            read: false,
          };
          setNotifications((prev) => [notification, ...prev]);
        }
      } catch {
        // 忽略非 JSON 消息
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // 自动重连
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, connected, markAsRead, markAllAsRead };
}
